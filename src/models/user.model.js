// src/models/user.model.js
import mongoose from "mongoose";

const ROLES = ["student", "teacher", "principal", "admin", "owner"];

const userSchema = new mongoose.Schema(
  {
    // ── Core identity ─────────────────────────────────────────────────────────
    name: { type: String, required: true, trim: true },
    fatherName: { type: String, trim: true, default: null },
    role: { type: String, enum: ROLES, required: true, default: "student" },
    password: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true },
    isHardcoded: { type: Boolean, default: false },
    gender: {
      type: String,
      enum: ["পুরুষ", "নারী", "ছেলে", "মেয়ে", null],
      default: null,
    },

    // ── Contact ───────────────────────────────────────────────────────────────
    phone: { type: String, trim: true, default: null },
    email: { type: String, trim: true, lowercase: true, default: null },

    // ── Address (structured) ──────────────────────────────────────────────────
    gramNam: { type: String, trim: true, default: null },
    dakghor: { type: String, trim: true, default: null },
    thana: { type: String, trim: true, default: null },
    jela: { type: String, trim: true, default: null },
    landmark: { type: String, trim: true, default: null },

    permanentGramNam: { type: String, trim: true, default: null },
    permanentDakghor: { type: String, trim: true, default: null },
    permanentThana: { type: String, trim: true, default: null },
    permanentJela: { type: String, trim: true, default: null },
    permanentSameAsPresent: { type: Boolean, default: true },

    // ── Education ─────────────────────────────────────────────────────────────
    qualification: { type: String, trim: true, default: null },
    educationComplete: { type: Boolean, default: null },
    degree: {
      type: String,
      enum: ["hsc", "hons", "masters", null],
      default: null,
    },
    currentYear: {
      type: String,
      enum: ["1st", "2nd", "3rd", "4th", "mba", "mbbs", "ma", null],
      default: null,
    },
    studentClass: { type: String, default: null },

    // ── Avatar ────────────────────────────────────────────────────────────────
    avatar: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },

    // ── Onboarding ────────────────────────────────────────────────────────────
    onboardingComplete: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });

export default mongoose.model("User", userSchema);
