// src/scripts/migrate.daily.lesson.js
import mongoose from "mongoose";
import DailyLesson from "../models/daily.lesson.model.js";
import dotenv from "dotenv";
dotenv.config();

const migrate = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ MongoDB connected");

  // date নেই এমন সব document খুঁজে বের করো
  const lessons = await DailyLesson.find({ date: { $exists: false } });
  console.log(`📦 Found ${lessons.length} lessons to migrate`);

  if (lessons.length === 0) {
    console.log("🎉 Nothing to migrate!");
    process.exit(0);
  }

  let success = 0;
  let failed = 0;

  for (const lesson of lessons) {
    try {
      lesson.date = lesson.createdAt; // createdAt থেকে date সেট
      await lesson.save({ validateBeforeSave: false });
      success++;
    } catch (err) {
      console.error(`❌ Failed for ${lesson._id}:`, err.message);
      failed++;
    }
  }

  console.log(`✅ Migrated: ${success} | ❌ Failed: ${failed}`);
  process.exit(0);
};

migrate().catch((err) => {
  console.error("💥 Migration crashed:", err);
  process.exit(1);
});
