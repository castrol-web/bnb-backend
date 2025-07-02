import express from "express";
import { Request } from 'express';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import crypto from "crypto";
import User from "../models/User";
import Room from "../models/Room"
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import Review from "../models/Review";
import authMiddleware from "../middleware/auth.middleware";
import Gallery from "../models/Gallery";
dotenv.config();
const router = express.Router();

const adminPassword = process.env.ADMIN_PASSWORD;

//s3 credentials
const accessKey = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION;
const bucketName = process.env.AWS_BUCKET_NAME;
if (!accessKey || !secretAccessKey || !region || !bucketName) {
    throw new Error("all S3 credentials are required")
}

//s3 object
const s3 = new S3Client({
    credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretAccessKey
    },
    region: region
});


//creating sudo admin
const sudoAdmin = async () => {
    try {
        const admin = await User.findOne({ email: "admin@example.com" });
        if (admin) {
            console.log("Admin user already exists")
            return;
        }
        //hashing the password
        const salt = await bcrypt.genSalt(Number(process.env.SALT) || 10);
        const hashedPassword = await bcrypt.hash(adminPassword || "adminpassword", salt);
        const newAdmin = new User({
            userName: "admin",
            email: "admin@example.com",
            phone: "0790792533",
            passwordHash: hashedPassword,
            role: "admin",
            isVerified: true
        });
        await newAdmin.save();
        console.log("Admin user created successfully");
    } catch (error) {
        console.error('Error seeding admin user:', error);
    }
}

sudoAdmin();

const storage = multer.memoryStorage();
const upload = multer({ storage });
const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");

// CREATE a room
router.post('/create-room', authMiddleware, upload.fields([{ name: 'pictures', maxCount: 10 }, { name: 'frontViewPicture', maxCount: 1 }]), async (req: Request, res: any) => {
    try {
        const {
            title,
            roomNumber,
            description,
            price,
            maxPeople,
            numberOfBeds,
            roomType,
            amenities,
            status
        } = req.body;

        if (!title || !roomNumber || !description || !price || !maxPeople || !numberOfBeds || !roomType) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const pictureFiles = files['pictures'] || [];
        const frontPicFile = files['frontViewPicture']?.[0];

        if (!frontPicFile || pictureFiles.length === 0) {
            return res.status(400).json({ message: 'Missing images' });
        }

        const pictureNames = pictureFiles.map(() => randomImageName());
        const frontPictureName = randomImageName();

        // Save room in DB first with image keys only
        const newRoom = new Room({
            title,
            roomNumber,
            description,
            price: Number(price),
            maxPeople: Number(maxPeople),
            numberOfBeds: Number(numberOfBeds),
            roomType,
            status,
            amenities: JSON.parse(amenities),
            pictures: pictureNames,
            frontViewPicture: frontPictureName
        });

        await newRoom.save();

        // Upload all slideshow images concurrently
        await Promise.all(
            pictureFiles.map((file, i) =>
                s3.send(new PutObjectCommand({
                    Bucket: bucketName,
                    Key: pictureNames[i],
                    Body: file.buffer,
                    ContentType: file.mimetype
                }))
            )
        );

        // Upload front view image
        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: frontPictureName,
            Body: frontPicFile.buffer,
            ContentType: frontPicFile.mimetype
        }));

        res.status(201).json({ message: "Room created successfully" });

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: "Failed to create the room!", error });
    }
});


// UPDATE a room
router.put('/room/:id', authMiddleware, upload.fields([{ name: 'pictures', maxCount: 10 }, { name: 'frontViewPicture', maxCount: 1 },]),
    async (req: Request, res: any) => {
        try {
            const room = await Room.findById(req.params.id);
            if (!room) return res.status(404).json({ message: 'Room not found' });

            const {
                title,
                roomNumber,
                description,
                price,
                maxPeople,
                numberOfBeds,
                roomType,
                status,
                amenities,
                imagesToKeep = '[]',
                keepFrontView,
            } = req.body;

            const files = req.files as { [key: string]: Express.Multer.File[] };
            const parsedKeepImages: string[] = JSON.parse(imagesToKeep || '[]');

            // Identify pictures to delete
            const picturesToDelete = room.pictures.filter(
                (img) => !parsedKeepImages.includes(img)
            );

            // Determine frontViewPicture deletion
            const shouldDeleteFront =
                keepFrontView !== 'true' && room.frontViewPicture;

            const newPictures: string[] = [];

            if (files?.pictures?.length) {
                for (const file of files.pictures) {
                    const key = randomImageName();
                    await s3.send(
                        new PutObjectCommand({
                            Bucket: bucketName,
                            Key: key,
                            Body: file.buffer,
                            ContentType: file.mimetype,
                        })
                    );
                    newPictures.push(key); // ONLY SAVE THE KEY
                }
            }

            // Upload new front view picture
            let newFront = room.frontViewPicture;
            if (files.frontViewPicture?.[0]) {
                const file = files.frontViewPicture[0];
                const key = randomImageName();
                await s3.send(
                    new PutObjectCommand({
                        Bucket: bucketName,
                        Key: key,
                        Body: file.buffer,
                        ContentType: file.mimetype,
                    })
                );
                newFront = key; // ONLY SAVE THE KEY
            } else if (!keepFrontView && !files.frontViewPicture?.[0]) {
                return res
                    .status(400)
                    .json({ message: 'Front view image is required.' });
            }

            const finalPictures = [...parsedKeepImages, ...newPictures];

            if (finalPictures.length === 0) {
                return res.status(400).json({
                    message: 'At least one slideshow image is required.',
                });
            }

            // DELETE removed images from S3
            const deleteKeys = [...picturesToDelete];
            if (shouldDeleteFront) deleteKeys.push(room.frontViewPicture);
            if (deleteKeys.length) {
                await s3.send(
                    new DeleteObjectsCommand({
                        Bucket: bucketName,
                        Delete: {
                            Objects: deleteKeys.map((Key) => ({ Key })),
                        },
                    })
                );
            }

            //Save updated fields
            room.title = title;
            room.roomNumber = roomNumber;
            room.description = description;
            room.price = price;
            room.maxPeople = maxPeople;
            room.numberOfBeds = numberOfBeds;
            room.roomType = roomType;
            room.status = status;
            room.amenities = JSON.parse(amenities);
            room.pictures = finalPictures; //Only keys
            room.frontViewPicture = newFront; //Only key

            await room.save();

            res.status(200).json({ message: 'Room updated successfully' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Failed to update room', error });
        }
    }
);


// DELETE a room
router.delete('/room/:id', authMiddleware, async (req: Request, res: any) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) {
            return res.status(404).json({ message: "Room not found" });
        }

        // Collect all S3 keys to delete: frontViewPicture + pictures
        const keysToDelete = [
            ...(room.pictures || []),
            ...(room.frontViewPicture ? [room.frontViewPicture] : [])
        ];

        if (keysToDelete.length > 0) {
            await s3.send(
                new DeleteObjectsCommand({
                    Bucket: bucketName,
                    Delete: {
                        Objects: keysToDelete.map((Key) => ({ Key }))
                    }
                })
            );
        }

        // Delete room from DB
        const deletedRoom = await Room.findByIdAndDelete(req.params.id);
        if (!deletedRoom) {
            return res.status(404).json({ error: 'Room not found after deletion attempt' });
        }

        res.status(200).json({ message: 'Room and associated images deleted successfully' });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


// DELETE: A specific review
router.delete('/:id', async (req: Request, res: any) => {
    try {
        const deleted = await Review.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Review not found' });
        res.status(200).json({ message: 'Review deleted' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE
router.post("/post-gallery", upload.fields([{ name: "pictures", maxCount: 10 }]), async (req: Request, res: any) => {
    try {
        const { caption, category } = req.body;
        if (!caption || !category) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const pictureFiles = files['pictures'] || [];

        if (pictureFiles.length === 0) {
            return res.status(400).json({ message: 'Missing images' });
        }

        const pictureNames = pictureFiles.map(() => randomImageName());

        // Save room in DB first with image keys only
        const newGalley = new Gallery({
            caption,
            pictures: pictureNames,
            category
        });

        await newGalley.save();

        // Upload all slideshow images concurrently
        await Promise.all(
            pictureFiles.map((file, i) =>
                s3.send(new PutObjectCommand({
                    Bucket: bucketName,
                    Key: pictureNames[i],
                    Body: file.buffer,
                    ContentType: file.mimetype
                }))
            )
        );

        res.status(201).json({ message: "gallery added successfully" });
    } catch (error: any) {
        console.error({ message: "an error occured", error })
        res.status(500).json({ message: error.message });
    }
});



// READ SINGLE
export const getSingleGallery = async (req: Request, res: any) => {
    try {
        const gallery = await Gallery.findById(req.params.id);
        if (!gallery) return res.status(404).json({ message: 'Not found' });
        res.status(200).json(gallery);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// UPDATE
export const updateGallery = async (req: Request, res: any) => {
    try {
        const { caption, category, imagesToKeep } = req.body;
        const gallery = await Gallery.findById(req.params.id);
        if (!gallery) return res.status(404).json({ message: 'Not found' });

        let updatedPictures = [...(imagesToKeep ? JSON.parse(imagesToKeep) : [])];


        gallery.caption = caption;
        gallery.category = category;
        gallery.pictures = updatedPictures;

        await gallery.save();
        res.status(200).json(gallery);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE
export const deleteGallery = async (req: Request, res: any) => {
    try {
        const gallery = await Gallery.findByIdAndDelete(req.params.id);
        if (!gallery) return res.status(404).json({ message: 'Not found' });
        res.status(200).json({ message: 'Gallery deleted' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};


async function generateSignedUrl(coverImage?: string | null): Promise<string> {
    if (!coverImage) {
        throw new Error("Invalid image key provided")
    }
    const getObjectParams = {
        Bucket: bucketName,
        Key: coverImage,
    }

    const command = new GetObjectCommand(getObjectParams);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return url;
}

export default router;

