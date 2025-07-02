import mongoose from 'mongoose';

const gallerySchema = new mongoose.Schema({
  caption: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: [
      'Rooms & Suites',
      'Dining & Cuisine',
      'Reception & Lounge',
      'Amenities',
      'Outdoor & Garden',
      'Events & Conferences',
      'Guest Experience',
      'Nearby Attractions',
    ],
    required: true,
  },
  pictures: {
    type: [String], // Array of image URLs or S3 keys
    required: true,
  },
}, {
  timestamps: true,
});

export default mongoose.model('Gallery', gallerySchema);
