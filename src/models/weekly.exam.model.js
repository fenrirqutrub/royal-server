// src/models/weekly.exam.model.js
import mongoose from "mongoose";

const weeklyExamSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true },
    subject: { type: String, required: true, trim: true },
    teacher: { type: String, required: true, trim: true },
    teacherSlug: { type: String, default: null, index: true }, // e.g. "T2601"
    class: { type: String, required: true, trim: true },
    mark: { type: Number, required: true },
    ExamNumber: { type: String, required: true },
    topics: { type: String, required: true, trim: true },
    images: [{ type: String }],
  },
  { timestamps: true },
);

export default mongoose.model("WeeklyExam", weeklyExamSchema);
