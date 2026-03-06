// src/models/weekly.exam.model.js
import mongoose from "mongoose";

const weeklyExamSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
    },
    teacher: {
      type: String,
      required: [true, "Teacher name is required"],
      trim: true,
    },
    // ✅ NEW — teacher's unique slug (e.g. T2601, P2601)
    // used to filter exams by teacher on the dashboard
    teacherSlug: {
      type: String,
      trim: true,
      default: null,
    },
    class: {
      type: String,
      required: [true, "Class is required"],
      trim: true,
    },
    mark: {
      type: Number,
      required: [true, "Mark is required"],
      min: [1, "Mark must be at least 1"],
    },
    ExamNumber: {
      type: String,
      required: [true, "Exam number is required"],
      trim: true,
    },
    topics: {
      type: String,
      required: [true, "Topics are required"],
      trim: true,
      minlength: [20, "Topics must be at least 20 characters"],
    },
    images: [
      {
        imageUrl: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
  },
  { timestamps: true },
);

// index for fast slug-based filtering
weeklyExamSchema.index({ teacherSlug: 1 });

const WeeklyExam = mongoose.model("WeeklyExam", weeklyExamSchema);
export default WeeklyExam;
