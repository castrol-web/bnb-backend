import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userName: { type: String, required: true, unique: true },
  lastName: { type: String },
  firstName: { type: String },
  email: { type: String, required: true, unique: true, index: true },
  phone: String,
  nationality: String,
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['client', 'admin'], default: 'client' },
  isVerified: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
