// src/config/db.js
// Establishes and manages the MongoDB connection via Mongoose.

import mongoose from 'mongoose';

/** @type {boolean} — true only after a successful mongoose.connect() */
export let dbReady = false;

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.warn('[DB] MONGO_URI is not defined in .env — running without database (in-memory mode).');
    return;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // fail fast if Atlas is unreachable
      socketTimeoutMS: 45000,
      bufferCommands: false,          // don't queue ops when disconnected
    });

    dbReady = true;
    console.log(`[DB] MongoDB connected → ${conn.connection.host}`);
  } catch (err) {
    dbReady = false;
    console.warn(`[DB] Connection failed: ${err.message}`);
    console.warn('[DB] Server will continue without database — AI features still work.');
  }

  // Track connection state changes
  mongoose.connection.on('disconnected', () => {
    dbReady = false;
    console.warn('[DB] MongoDB disconnected — attempting reconnect…');
  });
  mongoose.connection.on('reconnected', () => {
    dbReady = true;
    console.log('[DB] MongoDB reconnected.');
  });
};

export default connectDB;