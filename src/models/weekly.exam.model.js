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

    // ─── Number Type Field ───────────────────────────────────────
    numberType: {
      type: String,
      enum: ["pageNumber", "chapterNumber"],
      default: "chapterNumber",
    },

    // ─── Page Number (optional) ───────────────────────────────────
    pageNumber: {
      type: String,
      trim: true,
      default: null,
    },

    // ─── Chapter Number (optional) ────────────────────────────────
    chapterNumber: {
      type: String,
      trim: true,
      default: null,
    },

    topics: { type: String, required: true, trim: true },

    // ─── Question Field (optional) ────────────────────────────────
    question: {
      type: String,
      trim: true,
      default: null,
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

// ─── Virtual for getting the active number value ──────────────────────────
weeklyExamSchema.virtual("numberValue").get(function () {
  return this.numberType === "pageNumber"
    ? this.pageNumber
    : this.chapterNumber;
});

// ─── Ensure virtuals are included in JSON ─────────────────────────────────
weeklyExamSchema.set("toJSON", { virtuals: true });
weeklyExamSchema.set("toObject", { virtuals: true });

export default mongoose.model("WeeklyExam", weeklyExamSchema);
