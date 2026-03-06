// src/models/teacher.model.js

import mongoose from "mongoose";

const teacherProfileSchema = new mongoose.Schema(
  {
    nickname: { type: String, default: "Teacher" },
    avatarUrl: { type: String, default: null },
  },
  { timestamps: true },
);

export default mongoose.model("TeacherProfile", teacherProfileSchema);
