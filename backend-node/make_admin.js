import connectDB from './src/config/db.js';
import User from './src/models/User.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  await connectDB();
  try {
    const user = await User.findOneAndUpdate(
      { role: 'user' }, 
      { $set: { role: 'admin' } }, 
      { sort: { createdAt: 1 }, new: true }
    );
    if (user) {
      console.log(`Successfully elevated ${user.email} to ADMIN status!`);
    } else {
      console.log(`Failed - no regular user found.`);
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
};
run();
