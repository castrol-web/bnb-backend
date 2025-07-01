import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Support multiple rooms in a booking
  rooms: [
    {
      room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
      checkInDate: { type: Date, required: true },
      checkOutDate: { type: Date, required: true },
      guests: { type: Number, required: true },
      pricePerNight: { type: Number, required: true }, // in case price changes later
      totalNights: { type: Number, required: true },
      subtotal: { type: Number, required: true } // guests x price x nights
    }
  ],

  // Booking Summary
  totalAmount: { type: Number, required: true },
  bookingDate: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending',
  },

  paymentInfo: {
    method: { type: String, enum: ['card', 'mobile_money', 'cash', 'none'], default: 'none' },
    isPaid: { type: Boolean, default: false },
    paidAt: Date,
    transactionId: String
  },

  // Optional
  specialRequests: String,
}, {
  timestamps: true
});

export default mongoose.model("Booking", bookingSchema);
