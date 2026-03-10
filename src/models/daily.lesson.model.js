// src/models/daily.lesson.model.js

// src/models/daily.lesson.model.js

import mongoose from "mongoose";

const dailyLessonSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: [true, "বিষয় আবশ্যিক"],
      trim: true,
    },
    teacher: {
      type: String,
      required: [true, "শিক্ষকের নাম আবশ্যিক"],
      trim: true,
    },
    teacherSlug: {
      type: String,
      trim: true,
      default: null,
    },
    class: {
      type: String,
      required: [true, "শ্রেণি আবশ্যিক"],
      trim: true,
    },
    mark: {
      type: Number,
      default: 0,
    },
    chapterNumber: {
      type: String,
      required: [true, "অধ্যায় নম্বর আবশ্যিক"],
      trim: true,
    },
    topics: {
      type: String,
      required: [true, "বিষয়বস্তু আবশ্যিক"],
      minlength: [20, "কমপক্ষে ২০ অক্ষর লিখুন"],
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true },
);

const DailyLesson = mongoose.model("DailyLesson", dailyLessonSchema);

export default DailyLesson;
