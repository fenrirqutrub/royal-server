// src/models/user.model.js
import mongoose from "mongoose";

const ROLES = ["student", "teacher", "principal", "admin", "owner"];
const RELIGIONS = ["ইসলাম", "হিন্দু", "বৌদ্ধ", "খ্রিষ্টান"];
const SUBJECTS = ["বিজ্ঞান", "মানবিক", "বাণিজ্য"];
const userSchema = new mongoose.Schema(
  {
    // ── Core identity ─────────────────────────────────────────────────────────
    name: { type: String, required: true, trim: true },
    fatherName: { type: String, trim: true, default: null },
    motherName: { type: String, trim: true, default: null },
    role: { type: String, enum: ROLES, required: true, default: "student" },
    password: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true },
    isHardcoded: { type: Boolean, default: false },
    gender: {
      type: String,
      enum: ["পুরুষ", "নারী", "ছেলে", "মেয়ে", null],
      default: null,
    },
    dateOfBirth: { type: Date, default: null },
    religion: {
      type: String,
      enum: [...RELIGIONS, null],
      default: null,
    },

    // ── Contact ───────────────────────────────────────────────────────────────
    phone: { type: String, trim: true, default: null },
    email: { type: String, trim: true, lowercase: true, default: null },
    emergencyContact: { type: String, trim: true, default: null },

    // ── Present Address ───────────────────────────────────────────────────────
    gramNam: { type: String, trim: true, default: null }, // village
    para: { type: String, trim: true, default: null }, // para
    thana: { type: String, trim: true, default: null },
    district: { type: String, trim: true, default: null },
    division: { type: String, trim: true, default: null },
    landmark: { type: String, trim: true, default: null },

    // ── Permanent Address ──────────────────────────────────────────────────────
    permanentSameAsPresent: { type: Boolean, default: true },
    permanentGramNam: { type: String, trim: true, default: null },
    permanentPara: { type: String, trim: true, default: null },
    permanentThana: { type: String, trim: true, default: null },
    permanentDistrict: { type: String, trim: true, default: null },
    permanentDivision: { type: String, trim: true, default: null },

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
    studentSubject: {
      type: String,
      enum: [...SUBJECTS, null],
      default: null,
    },
    roll: { type: String, trim: true, default: null },
    schoolName: { type: String, trim: true, default: null },

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
