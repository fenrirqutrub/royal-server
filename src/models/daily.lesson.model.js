// src/models/daily.lesson.model.js

import mongoose from "mongoose";

const dailyLessonSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: [true, "বিষয় আবশ্যিক"],
      trim: true,
    },
    // ─── এটাই মূল পরিবর্তন ───
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "শিক্ষক আবশ্যিক"],
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
    referenceType: {
      type: String,
      enum: ["chapter", "page"],
      default: "chapter",
    },
    chapterNumber: {
      type: String,
      required: [true, "অধ্যায়/পৃষ্ঠা নম্বর আবশ্যিক"],
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
    date: {
      type: Date,
      required: [true, "তারিখ আবশ্যিক"],
      default: Date.now,
    },
  },
  { timestamps: true },
);

const DailyLesson = mongoose.model("DailyLesson", dailyLessonSchema);
export default DailyLesson;
