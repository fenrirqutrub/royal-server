// scripts/migrate-qualification-to-collegeName.js
//
// Run: node scripts/migrate-qualification-to-collegeName.js
//
// qualification field এ যা ছিল সেটা collegeName এ copy করে,
// তারপর qualification field null করে দেয়।

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;
if (!MONGODB_URI) {
  console.error("❌  MONGO_URI not set in .env");
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
console.log("✅  Connected to MongoDB");

const result = await mongoose.connection.collection("users").updateMany(
  {
    qualification: { $exists: true, $ne: null, $ne: "" },
    collegeName: { $in: [null, undefined, ""] },
  },
  [
    {
      $set: {
        collegeName: "$qualification",
        qualification: null,
      },
    },
  ],
);

console.log(`✅  Migration complete — ${result.modifiedCount} user(s) updated`);

await mongoose.disconnect();
