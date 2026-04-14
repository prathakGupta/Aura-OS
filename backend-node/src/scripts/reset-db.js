// backend-node/src/scripts/reset-db.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../..", ".env") });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ Error: MONGO_URI is not defined in .env");
  process.exit(1);
}

const resetDatabase = async () => {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB.");

    const collections = ["users", "guardians", "alertlogs", "clinicalreports", "userstates"];
    
    console.log("🧹 Clearing collections...");
    
    for (const collectionName of collections) {
      const collection = mongoose.connection.collection(collectionName);
      const stats = await collection.deleteMany({});
      console.log(`   - ${collectionName}: Deleted ${stats.deletedCount} documents.`);
    }

    console.log("\n✨ Database reset complete.");
  } catch (error) {
    console.error("❌ Database reset failed:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB.");
    process.exit(0);
  }
};

// Confirmation prompt would be good but for a script run via npm we'll assume the user knows what they're doing from the implementation plan.
resetDatabase();
