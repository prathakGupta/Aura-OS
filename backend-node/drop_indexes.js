import connectDB from './src/config/db.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  await connectDB();
  const db = mongoose.connection.db;
  try {
    await db.collection('users').dropIndex('authUid_1');
    console.log('Successfully dropped authUid_1');
  } catch (err) {
    console.log('authUid_1 not found or already dropped:', err.message);
  }
  try {
    await db.collection('users').dropIndex('firebaseUid_1');
    console.log('Successfully dropped firebaseUid_1');
  } catch (err) {
    console.log('firebaseUid_1 not found or already dropped:', err.message);
  }
  process.exit(0);
};

run();
