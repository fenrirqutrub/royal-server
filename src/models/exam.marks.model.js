// src/models/exam.marks.model.js
import mongoose from "mongoose";

const examMarksSchema = new mongoose.Schema(
  {
    pages: [
      {
        pageNumber: { type: Number, required: true },
        url: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
    totalPages: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const ExamMarks = mongoose.model("ExamMarks", examMarksSchema);
export default ExamMarks;
