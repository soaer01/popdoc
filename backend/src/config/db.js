import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/popdoc';
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Database] MongoDB connected successfully at ${uri}`);
  } catch (err) {
    console.warn(`[Database] MongoDB connection error: ${err.message}`);
    console.warn('[Database] Continuing in scaffolded response mode.');
  }
}
