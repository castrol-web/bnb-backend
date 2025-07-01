import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
    title: { type: String, required: true },
    roomNumber: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    amenities: [{ type: String }],
    price: { type: Number, required: true },
    maxPeople: { type: Number, required: true },
    numberOfBeds: { type: Number, required: true },
    roomType: {
        type: String,
        enum: ['Classic', 'Deluxe', 'Suite', 'Single', 'Double'],
        required: true,
    },
    pictures: [{ type: String , required: true}],
    frontViewPicture: { type: String, required: true },
    status: {
        type: String,
        enum: ['available', 'booked', 'maintenance'],
        default: 'available',
    },
    starRating: { type: Number, min: 0, max: 5, default: 0 },
}, {
    timestamps: true
});

export default mongoose.model('Room', roomSchema);
