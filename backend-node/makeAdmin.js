import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./src/models/User.js";

import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

const email = process.argv[2];

if (!email) {
  console.error("Usage: node makeAdmin.js <email>");
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { role: "admin" },
    { new: true }
  );

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  console.log(`✓ ${user.email} is now an admin`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});