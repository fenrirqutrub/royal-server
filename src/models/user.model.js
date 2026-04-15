// src/models/user.model.jsimport mongoose from "mongoose";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

const ROLES = ["student", "teacher", "principal", "admin", "owner"];
const RELIGIONS = ["ইসলাম", "হিন্দু", "বৌদ্ধ", "খ্রিষ্টান"];
const SUBJECTS = ["বিজ্ঞান", "মানবিক", "বাণিজ্য"];
const DEGREES = ["hsc", "hons", "masters"];
const CURRENT_YEARS = ["1st", "2nd", "3rd", "4th", "mba", "mbbs", "ma"];
const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    // ── Basic Identity ──
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
    religion: { type: String, enum: [...RELIGIONS, null], default: null },

    // ── Contact ──
    phone: { type: String, trim: true, default: null },
    email: { type: String, trim: true, lowercase: true, default: null },
    emergencyContact: { type: String, trim: true, default: null },

    // ── Present Address ──
    gramNam: { type: String, trim: true, default: null },
    para: { type: String, trim: true, default: null },
    thana: { type: String, trim: true, default: null },
    district: { type: String, trim: true, default: null },
    division: { type: String, trim: true, default: null },
    landmark: { type: String, trim: true, default: null },

    // ── Permanent Address ──
    permanentSameAsPresent: { type: Boolean, default: true },
    permanentGramNam: { type: String, trim: true, default: null },
    permanentPara: { type: String, trim: true, default: null },
    permanentThana: { type: String, trim: true, default: null },
    permanentDistrict: { type: String, trim: true, default: null },
    permanentDivision: { type: String, trim: true, default: null },

    // ── Staff Education (teacher/principal/admin) ──
    collegeName: { type: String, trim: true, default: null },
    qualification: { type: String, trim: true, default: null },
    educationComplete: { type: Boolean, default: null },
    degree: { type: String, enum: [...DEGREES, null], default: null },
    currentYear: {
      type: String,
      enum: [...CURRENT_YEARS, null],
      default: null,
    },

    // ── Student Education ──
    studentClass: { type: String, default: null },
    studentSubject: { type: String, enum: [...SUBJECTS, null], default: null },
    roll: { type: String, trim: true, default: null },
    schoolName: { type: String, trim: true, default: null },

    // ── Avatar ──
    avatar: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },

    // ── Status ──
    onboardingComplete: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ── Indexes ──
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });

// ── Password Helpers ──
const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);
const isHashed = (pw) => typeof pw === "string" && pw.startsWith("$2b$");

// ── Pre-save ──
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  if (isHashed(this.password)) return;
  this.password = await hashPassword(this.password);
});

// ── Pre-update ──
userSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany"],
  async function () {
    const update = this.getUpdate();
    const pw = update?.password ?? update?.$set?.password;
    if (!pw || isHashed(pw)) return;
    const hashed = await hashPassword(pw);
    if (update.$set) update.$set.password = hashed;
    else update.password = hashed;
  },
);

// ── Verify password ──
userSchema.methods.verifyPassword = async function (plain) {
  if (!isHashed(this.password)) {
    if (this.password !== plain) return false;
    this.password = await hashPassword(plain);
    await this.save();
    return true;
  }
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model("User", userSchema);
