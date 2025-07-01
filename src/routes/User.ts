import express from "express";
import cors from 'cors';
import { Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import multer from "multer";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import User from "../models/User";
import dotenv from "dotenv";
import Token from "../models/Token";
import { sendConfirmationMail } from "../util/SendMail";
import authMiddleware from "../middleware/auth.middleware";
import { transport } from "../util/nodemailer";
import Reviews from "../models/Review";
import Room from "../models/Room";
import Review from "../models/Review";
import Booking from "../models/Booking";
dotenv.config()
const router = express.Router();

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

type registerProps = {
    userName: string,
    firstName: string,
    lastName: string;
    phone: string;
    email: string;
    nationality: string;
    password: string;
}

type loginProps = {
    email: string,
    password: string
}
const secretKey = String(process.env.JWT_PRIVATE_KEY);

//storage for file upload in memory storage
const storage = multer.memoryStorage();
const randomFileName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

const upload = multer({ storage: storage });

//user registration
router.post('/register', async (req: Request<registerProps>, res: any) => {
    try {
        const { userName, firstName, lastName, phone, email, nationality, password } = req.body;

        // Check if email exists
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ message: "A user with this email already exists." });
        }

        // Check if username exists
        const existingUsername = await User.findOne({ userName });
        if (existingUsername) {
            return res.status(400).json({ message: "Username is already taken." });
        }

        // Hash password
        const salt = await bcrypt.genSalt(Number(process.env.SALT));
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const newUser = new User({
            userName,
            firstName,
            lastName,
            email,
            phone,
            nationality,
            passwordHash: hashedPassword,
            role: "client"
        });

        await newUser.save();

        // Create confirmation token
        const token = await new Token({
            userId: newUser._id,
            token: crypto.randomBytes(10).toString("hex")
        }).save();
        console.log(token.token)

        // Send confirmation email
        await sendConfirmationMail({
            userEmail: email,
            userName,
            token: token.token
        });

        res.status(201).json({ message: "Registration successful. Please verify your email." });

    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({
            message: 'An unexpected error occurred during registration. Please try again later.'
        });
    }
});

//user login
router.post('/login', async (req: Request<loginProps>, res: any) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ message: "all fields are required" })
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "Invalid email or password" })
        }

        //checking if they are verified users
        if (!user.isVerified) {
            return res.status(403).json({ message: "Please verify your email address before logging in." });
        }
        //comparing given password
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
            return res.status(401).json({ message: "invalid credentials" })
        }
        //generating token
        const token = jwt.sign({ id: user._id, role: user.role }, secretKey, { expiresIn: "1d" })
        res.status(201).json({
            token: token,
            role: user.role,
            name: user.firstName,
        });
    } catch (error) {
        console.error('Error logging in', error);
        res.status(500).json({ message: 'An error occured during logging in please try again later' });
    }
});


//contact us
router.post("/contact", async (req: Request, res: any) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: "All fields are required." });
    }

    try {
        await transport.sendMail({
            from: `"${name}" <${email}>`,
            to: process.env.USER,//helenus email 
            subject: `[Contact Form] ${subject}`,
            html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
        });

        res.status(201).json({ message: "Message sent successfully!" });
    } catch (err) {
        console.error("Failed to send contact form email", err);
        res.status(500).json({ message: "Failed to send message." });
    }
});


//verify email
router.post("/verify-email", async (req: Request, res: any) => {
    const { token } = req.body;

    try {
        const tokenDoc = await Token.findOne({ token });
        if (!tokenDoc) {
            return res.status(400).json({ message: "Invalid or expired token." });
        }

        const user = await User.findById(tokenDoc.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: "User already verified." });
        }

        user.isVerified = true;
        await user.save();
        await tokenDoc.deleteOne();

        res.status(200).json({ message: "Email verified successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Verification failed" });
    }
});

// POST: Add a review to a room
router.post('/review-room', async (Request, res: any) => {
    try {
        const { room, user, comment, rating } = Request.body;

        // Make sure the room exists
        const existingRoom = await Room.findById(room);
        if (!existingRoom) return res.status(404).json({ error: 'Room not found' });

        const newReview = new Reviews({ room, user, comment, rating });
        const savedReview = await newReview.save();

        // Optional: Update room's average starRating
        const allReviews = await Review.find({ room });
        const averageRating =
            allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

        existingRoom.starRating = parseFloat(averageRating.toFixed(1));
        await existingRoom.save();

        res.status(201).json(savedReview);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// GET: All reviews for a specific room
router.get('/review/:roomId', async (req, res) => {
    try {
        const reviews = await Review.find({ room: req.params.roomId })
            .populate('user', 'name email')
            .sort({ createdAt: -1 });
        res.status(200).json(reviews);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});


// READ all rooms
router.get('/rooms', async (req: Request, res: any) => {
    try {
        const rooms = await Room.find();
        console.log(rooms)

        if (!rooms || rooms.length === 0) {
            return res.status(404).json({ message: "No room found!" });
        }

        const roomsWithSignedUrls = await Promise.all(
            rooms.map(async (room) => {
                let signedFrontView = null;
                let signedPictures: string[] = [];

                try {
                    if (room.frontViewPicture) {
                        signedFrontView = await generateSignedUrl(room.frontViewPicture);
                    }

                    if (room.pictures && room.pictures.length > 0) {
                        signedPictures = await Promise.all(
                            room.pictures.map((key: string) => generateSignedUrl(key))
                        );
                    }
                } catch (err) {
                    console.error(`Error generating signed URLs for room ${room._id}:`, err);
                }

                return {
                    ...room.toObject(),
                    frontViewPicture: signedFrontView,
                    pictures: signedPictures,
                };
            })
        );

        res.status(201).json(roomsWithSignedUrls);
    } catch (err: any) {
        console.error('Error fetching rooms:', err);
        res.status(500).json({ error: err.message });
    }
});


// READ single room by ID
router.get('/room/:id', async (req: Request, res: any) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).json({ error: 'Room not found' });
        let signedFrontView = null;
        let signedPictures: string[] = [];
        if (room.frontViewPicture) {
            signedFrontView = await generateSignedUrl(room.frontViewPicture);
        }
        if (room.pictures && room.pictures.length > 0) {
            signedPictures = await Promise.all(
                room.pictures.map((key: string) => generateSignedUrl(key))
            );
        }
        res.status(200).json({
            ...room.toObject(),
            frontViewPicture: signedFrontView,
            pictures: signedPictures,
        });
    } catch (error: any) {
        console.error(error)
        res.status(500).json({ message: "error fetching room", error });
    }
});


router.post("/bookings", authMiddleware, async (req: Request, res: any) => {
    try {
        const { rooms, totalAmount } = req.body;
        const id = req.user._id;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "You must login before submitting booking!" });
        }

        const email = user.email;
        const name = user.firstName;

        const newBooking = new Booking({
            user,
            rooms,
            totalAmount,
        });

        // Generate HTML from booked rooms
        const roomsHtml = rooms.map((room: any, index: number) => {
            return `
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;">${index + 1}</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${room.title}</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${room.guests}</td>
      <td style="padding: 10px; border: 1px solid #ddd;">$${room.pricePerNight}</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${room.totalNights}</td>
      <td style="padding: 10px; border: 1px solid #ddd;">$${room.subtotal}</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${new Date(room.checkInDate).toLocaleDateString()}</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${new Date(room.checkOutDate).toLocaleDateString()}</td>
    </tr>
  `;
        }).join("");


        // Send booking notification email
        await transport.sendMail({
            from: `"${name}" <${email}>`,
            to: process.env.USER,
            subject: "🏨 New Room Booking Received",
            html: `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #333;">📬 New Booking Alert</h2>

      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Total Booking Amount:</strong> <span style="color: green;">$${totalAmount.toFixed(2)}</span></p>

      <h3 style="margin-top: 20px;">Booking Details:</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead style="background-color: #f2f2f2;">
          <tr>
            <th style="padding: 10px; border: 1px solid #ddd;">#</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Room</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Guests</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Price/Night</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Nights</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Subtotal</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Check-in</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Check-out</th>
          </tr>
        </thead>
        <tbody>
          ${roomsHtml}
        </tbody>
      </table>

      <p style="margin-top: 20px;">📝 Please reach out to the customer to finalize details or offer any discounts.</p>
    </div>
  `,
        });


        await newBooking.save()
        res.status(201).json({ message: "Room booked successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error submitting booking", error });
    }
});



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