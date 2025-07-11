import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  title: { type: String, required: true },
  roomNumber: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  amenities: [{ type: String }],
  configurations: [
    {
      roomType: {
        type: String,
        enum: ['Triple', 'Small Double', 'Twin', 'Single', 'Double', 'Family'],
        required: true,
      },
      price: { type: Number, required: true },
      numberOfBeds: { type: Number, required: true },
      bedType: { type: String, enum: ['Single', 'Double', 'Queen', 'King', 'Bunk'], required: true },
      maxPeople: { type: Number, required: true },
    }
  ],
  pictures: [{ type: String, required: true }],
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
