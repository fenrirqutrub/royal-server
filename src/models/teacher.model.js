// src/models/teacher.model.js
import mongoose from "mongoose";

const ROLES = ["teacher", "principal", "admin"];

const teacherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    role: { type: String, enum: ROLES, default: "teacher" },
    password: { type: String, required: true }, // plain: same as role name
    isHardcoded: { type: Boolean, default: false },
    slug: { type: String, unique: true, sparse: true }, // e.g. T2601

    // ── profile fields (optional) ──────────────────────────────────────────
    phone: { type: String, trim: true, default: null },
    address: { type: String, trim: true, default: null },
    avatar: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
  },
  { timestamps: true },
);

export default mongoose.model("Teacher", teacherSchema);
