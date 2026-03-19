// src/models/user.model.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";

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

// ─── Pre-save hook ────────────────────────────────────────────────────────────
// Automatically hashes password before every save/create.
// Also migrates existing plain-text passwords on first login/save:
//   - bcrypt hashes always start with "$2b$" — if it doesn't, it's plain text
//   - On next save the plain text gets hashed transparently
const SALT_ROUNDS = 12;

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  // Already hashed — skip (handles edge case of double-save)
  if (this.password?.startsWith("$2b$")) return next();
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  next();
});

// Also catches findOneAndUpdate / updateOne / updateMany with password field
// Used in completeOnboarding and updateProfile via findByIdAndUpdate
userSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany"],
  async function (next) {
    const update = this.getUpdate();
    const pw = update?.password ?? update?.$set?.password;
    if (!pw) return next();
    // Already hashed — skip
    if (pw.startsWith("$2b$")) return next();
    const hashed = await bcrypt.hash(pw, SALT_ROUNDS);
    if (update.$set) update.$set.password = hashed;
    else update.password = hashed;
    next();
  },
);

// ─── Instance method: verify password ────────────────────────────────────────
userSchema.methods.verifyPassword = async function (plain) {
  // Support legacy plain-text passwords during migration window:
  // If stored value is not a bcrypt hash, compare directly then re-hash on match
  if (!this.password?.startsWith("$2b$")) {
    const legacyMatch = this.password === plain;
    if (legacyMatch) {
      // Migrate: hash and save silently
      this.password = await bcrypt.hash(plain, SALT_ROUNDS);
      await this.save();
    }
    return legacyMatch;
  }
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model("User", userSchema);
