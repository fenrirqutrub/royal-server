// src/models/weekly.exam.model.js
import mongoose from "mongoose";

const weeklyExamSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true },
    subject: { type: String, required: true, trim: true },
    teacher: { type: String, required: true, trim: true },
    teacherSlug: { type: String, default: null, index: true },
    class: { type: String, required: true, trim: true },
    mark: { type: Number, required: true },
    ExamNumber: { type: String, required: true },
    chapterNumber: {
      type: String,
      required: [true, "অধ্যায়/পৃষ্ঠা নম্বর আবশ্যিক"],
      trim: true,
    },
    topics: { type: String, required: true, trim: true },
    images: [
      {
        imageUrl: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
  },
  { timestamps: true },
);

export default mongoose.model("WeeklyExam", weeklyExamSchema);
