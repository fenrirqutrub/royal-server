import mongoose from "mongoose";
import dotenv from "dotenv";
import DailyLesson from "../models/daily.lesson.model.js";
import User from "../models/user.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;

// 👉 default avatar (change if needed)
const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?name=User&background=random";

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ DB connected");

    // ─────────────────────────────────────────────
    // 1. Fix Users without avatar
    // ─────────────────────────────────────────────
    const users = await User.find();

    let avatarUpdated = 0;

    for (const user of users) {
      if (!user.avatar?.url) {
        user.avatar = {
          url: DEFAULT_AVATAR,
          publicId: null,
        };
        await user.save();
        avatarUpdated++;
      }
    }

    console.log(`🖼️ Avatar updated: ${avatarUpdated}`);

    // ─────────────────────────────────────────────
    // 2. Fix DailyLesson teacher field
    // ─────────────────────────────────────────────
    const lessons = await DailyLesson.find();

    let lessonUpdated = 0;

    for (const lesson of lessons) {
      // যদি teacher already ObjectId হয় → skip
      if (mongoose.Types.ObjectId.isValid(lesson.teacher)) continue;

      // যদি teacher string (name) হয়
      if (typeof lesson.teacher === "string") {
        const user = await User.findOne({ name: lesson.teacher });

        if (user) {
          lesson.teacher = user._id;
          await lesson.save();
          lessonUpdated++;
        }
      }

      // fallback → teacherSlug দিয়ে match
      if (!lesson.teacher && lesson.teacherSlug) {
        const user = await User.findOne({ slug: lesson.teacherSlug });

        if (user) {
          lesson.teacher = user._id;
          await lesson.save();
          lessonUpdated++;
        }
      }
    }

    console.log(`📘 Lessons fixed: ${lessonUpdated}`);

    console.log("🎉 Sync completed");
    process.exit();
  } catch (err) {
    console.error("❌ Script error:", err);
    process.exit(1);
  }
}

run();
