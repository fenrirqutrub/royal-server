import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/user.model.js";
import { uploadSingleToCloudinary } from "../config/cloudinary.js";
import {
  HARDCODED_ADMIN,
  STAFF_ROLES,
  ROLE_PREFIX,
} from "../constants/admin.js";

const JWT_SECRET = process.env.JWT_SECRET || "changeme-secret";
const TOKEN_EXPIRY = "24h";

// ── Fingerprint hash করো — device info থেকে ──────────────────────────────────
const hashFingerprint = (raw) =>
  crypto
    .createHash("sha256")
    .update(raw ?? "")
    .digest("hex")
    .slice(0, 16);

// ── Token issue — fingerprint bind করা ───────────────────────────────────────
const issueToken = (user, isHardcoded = false, fingerprint = "") => {
  return jwt.sign(
    {
      id: user._id?.toString() ?? user._id,
      role: user.role,
      slug: user.slug ?? null,
      isHardcoded,
      fp: hashFingerprint(fingerprint),
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY },
  );
};

// ── Request থেকে fingerprint নাও ─────────────────────────────────────────────
const getFingerprint = (req) => {
  const ua = req.headers["user-agent"] ?? "";
  const lang = req.headers["accept-language"] ?? "";
  // IP নেব না — mobile-এ IP বদলায়
  return `${ua}|${lang}`;
};

export const makePayload = (u) => ({
  id: u._id?.toString() ?? u._id,
  name: u.name,
  fatherName: u.fatherName ?? null,
  motherName: u.motherName ?? null,
  email: u.email ?? null,
  phone: u.phone ?? null,
  role: u.role,
  slug: u.slug ?? "",
  isHardcoded: u.isHardcoded ?? false,
  onboardingComplete: u.onboardingComplete ?? false,
  gender: u.gender ?? null,
  avatar: u.avatar ?? { url: null, publicId: null },
  dateOfBirth: u.dateOfBirth ?? null,
  religion: u.religion ?? null,
});

// ─── Slug builder ─────────────────────────────────────────────────────────────
export const buildSlug = async (role, excludeId = null) => {
  const prefix = ROLE_PREFIX[role] ?? role[0].toUpperCase();
  const year = String(new Date().getFullYear()).slice(-2);
  const query = { slug: { $regex: `^${prefix}${year}` } };
  if (excludeId) query._id = { $ne: excludeId };

  const existing = await User.find(query, { slug: 1 }).lean();
  const used = new Set(
    existing
      .map((u) => parseInt(u.slug?.slice(-2) ?? "0", 10))
      .filter((n) => !isNaN(n)),
  );
  let seq = 1;
  while (used.has(seq)) seq++;
  return `${prefix}${year}${String(seq).padStart(2, "0")}`;
};

// ─── Shared address fields builder ────────────────────────────────────────────
const buildAddressFields = (body) => {
  const {
    gramNam,
    para,
    thana,
    district,
    division,
    landmark,
    permanentSameAsPresent,
    permanentGramNam,
    permanentPara,
    permanentThana,
    permanentDistrict,
    permanentDivision,
  } = body;

  const isSame =
    permanentSameAsPresent === "true" || permanentSameAsPresent === true;

  return {
    gramNam: gramNam?.trim() ?? null,
    para: para?.trim() ?? null,
    thana: thana?.trim() ?? null,
    district: district?.trim() ?? null,
    division: division?.trim() ?? null,
    landmark: landmark?.trim() ?? null,
    permanentSameAsPresent: isSame,
    permanentGramNam: isSame
      ? gramNam?.trim()
      : (permanentGramNam?.trim() ?? null),
    permanentPara: isSame
      ? (para?.trim() ?? null)
      : (permanentPara?.trim() ?? null),
    permanentThana: isSame ? thana?.trim() : (permanentThana?.trim() ?? null),
    permanentDistrict: isSame
      ? district?.trim()
      : (permanentDistrict?.trim() ?? null),
    permanentDivision: isSame
      ? (division?.trim() ?? null)
      : (permanentDivision?.trim() ?? null),
  };
};

// ── Token verify helper — fingerprint check সহ ───────────────────────────────
const verifyToken = (token, req) => {
  const decoded = jwt.verify(token, JWT_SECRET);

  // fingerprint check — অন্য device থেকে চুরি করা token কাজ করবে না
  const currentFp = hashFingerprint(getFingerprint(req));
  if (decoded.fp && decoded.fp !== currentFp) {
    const err = new Error("Fingerprint mismatch");
    err.name = "FingerprintError";
    throw err;
  }

  return decoded;
};

// ── Authorization header থেকে token বের করো ──────────────────────────────────
const extractToken = (req) => {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return null;
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { phone, email, password } = req.body;
    if (!password) return res.status(400).json({ message: "পাসওয়ার্ড দিন" });
    if (!phone && !email)
      return res.status(400).json({ message: "ফোন বা ইমেইল দিন" });

    const fp = getFingerprint(req);

    if (phone?.trim() === HARDCODED_ADMIN.phone) {
      if (password !== HARDCODED_ADMIN.password)
        return res.status(401).json({ message: "তথ্য সঠিক নয়" });
      const token = issueToken(
        { _id: HARDCODED_ADMIN._id, role: "owner" },
        true,
        fp,
      );
      return res.status(200).json({
        success: true,
        token,
        user: makePayload(HARDCODED_ADMIN),
      });
    }

    const query = phone
      ? { phone: phone.trim() }
      : { email: email.toLowerCase() };
    const user = await User.findOne(query);
    if (!user || !(await user.verifyPassword(password)))
      return res.status(401).json({ message: "ফোন নম্বর বা পাসওয়ার্ড ভুল" });

    const token = issueToken(user, false, fp);
    return res.status(200).json({
      success: true,
      token,
      user: makePayload(user),
    });
  } catch (err) {
    return res.status(500).json({ message: "লগইন ব্যর্থ", error: err.message });
  }
};

// ─── POST /api/auth/check-staff-phone ────────────────────────────────────────
export const checkStaffPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone?.trim())
      return res.status(400).json({ message: "ফোন নম্বর দিন" });

    const record = await User.findOne({
      phone: phone.trim(),
      role: { $in: STAFF_ROLES },
      onboardingComplete: false,
    });

    if (!record)
      return res.status(404).json({
        message:
          "এই ফোন নম্বরে কোনো অ্যাকাউন্ট পাওয়া যায়নি। অনুগ্রহ করে প্রশাসকের সাথে যোগাযোগ করুন।",
      });

    return res.status(200).json({ name: record.name, role: record.role });
  } catch (err) {
    return res.status(500).json({ message: "ব্যর্থ", error: err.message });
  }
};

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
export const signup = async (req, res) => {
  try {
    const {
      name,
      fatherName,
      motherName,
      phone,
      password,
      gender,
      dateOfBirth,
      religion,
      emergencyContact,
      role,
      studentClass,
      studentSubject,
      roll,
      schoolName,
      educationComplete,
      degree,
      currentYear,
      qualification,
      email,
    } = req.body;

    const isStudent = !role || role === "student";
    const fp = getFingerprint(req);

    if (!password) return res.status(400).json({ message: "পাসওয়ার্ড দিন" });
    if (!req.body.gramNam?.trim())
      return res.status(400).json({ message: "গ্রামের নাম দিন" });
    if (!req.body.thana?.trim())
      return res.status(400).json({ message: "থানা দিন" });
    if (!req.body.district?.trim())
      return res.status(400).json({ message: "জেলা দিন" });

    let parsedDob = null;
    if (dateOfBirth) {
      const d = new Date(dateOfBirth);
      if (isNaN(d.getTime()))
        return res.status(400).json({ message: "জন্ম তারিখ সঠিক নয়" });
      parsedDob = d;
    }

    let avatar = { url: null, publicId: null };
    if (req.file) {
      const result = await uploadSingleToCloudinary(req.file, "avatars");
      avatar = { url: result.secure_url, publicId: result.public_id };
    }

    const sharedFields = {
      fatherName: fatherName?.trim() ?? null,
      motherName: motherName?.trim() ?? null,
      password,
      gender: gender || null,
      dateOfBirth: parsedDob,
      religion: religion || null,
      emergencyContact: emergencyContact?.trim() ?? null,
      avatar,
      onboardingComplete: true,
      ...buildAddressFields(req.body),
    };

    const CLASSES_WITH_SUBJECT = [
      "নবম শ্রেণি",
      "দশম শ্রেণি",
      "একাদশ শ্রেণি",
      "দ্বাদশ শ্রেণি",
    ];

    if (isStudent) {
      if (!name?.trim()) return res.status(400).json({ message: "নাম লিখুন" });
      const trimmedPhone = phone?.trim();
      if (!trimmedPhone)
        return res.status(400).json({ message: "ফোন নম্বর দিন" });

      if (await User.findOne({ phone: trimmedPhone }))
        return res
          .status(409)
          .json({ message: "এই ফোন নম্বর ইতিমধ্যে নিবন্ধিত" });

      const slug = await buildSlug("student");
      const user = await User.create({
        name: name.trim(),
        role: "student",
        phone: trimmedPhone,
        email: email?.toLowerCase().trim() || null,
        studentClass: studentClass ?? null,
        studentSubject: CLASSES_WITH_SUBJECT.includes(studentClass)
          ? (studentSubject ?? null)
          : null,
        roll: roll?.trim() ?? null,
        schoolName: schoolName?.trim() ?? null,
        slug,
        ...sharedFields,
      });

      const token = issueToken(user, false, fp);
      return res
        .status(201)
        .json({ success: true, token, user: makePayload(user) });
    }

    if (!STAFF_ROLES.includes(role))
      return res.status(400).json({ message: "অবৈধ ভূমিকা" });

    const trimmedPhone = phone?.trim();
    if (!trimmedPhone)
      return res.status(400).json({ message: "ফোন নম্বর দিন" });

    const staffRecord = await User.findOne({
      phone: trimmedPhone,
      role,
      onboardingComplete: false,
    });

    if (!staffRecord)
      return res.status(404).json({
        message:
          "এই ফোন নম্বরে কোনো অ্যাকাউন্ট পাওয়া যায়নি। অনুগ্রহ করে প্রশাসকের সাথে যোগাযোগ করুন।",
      });

    const eduComplete =
      educationComplete === "true" || educationComplete === true;

    Object.assign(staffRecord, sharedFields, {
      email: email?.toLowerCase().trim() || null,
      qualification: qualification?.trim() ?? null,
      educationComplete: eduComplete,
      degree: eduComplete ? (degree ?? null) : null,
      currentYear: !eduComplete ? (currentYear ?? null) : null,
    });

    await staffRecord.save();

    const token = issueToken(staffRecord, false, fp);
    return res
      .status(200)
      .json({ success: true, token, user: makePayload(staffRecord) });
  } catch (err) {
    console.error(
      "[signup] error:",
      err.message,
      JSON.stringify(err.errors ?? {}),
    );
    return res
      .status(500)
      .json({ message: "নিবন্ধন ব্যর্থ", error: err.message });
  }
};

// ─── POST /api/auth/onboarding ────────────────────────────────────────────────
export const completeOnboarding = async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: "লগইন করুন" });

    let decoded;
    try {
      decoded = verifyToken(token, req);
    } catch {
      return res.status(401).json({ message: "সেশন মেয়াদোত্তীর্ণ" });
    }

    if (decoded.isHardcoded)
      return res.status(403).json({ message: "প্রযোজ্য নয়" });

    const {
      phone,
      password,
      gender,
      dateOfBirth,
      religion,
      emergencyContact,
      qualification,
      educationComplete,
      degree,
      currentYear,
    } = req.body;

    if (
      !phone?.trim() ||
      !password ||
      !req.body.gramNam?.trim() ||
      !req.body.thana?.trim() ||
      !req.body.district?.trim()
    )
      return res.status(400).json({ message: "প্রয়োজনীয় তথ্য পূরণ করুন" });

    let parsedDob = null;
    if (dateOfBirth) {
      const d = new Date(dateOfBirth);
      if (isNaN(d.getTime()))
        return res.status(400).json({ message: "জন্ম তারিখ সঠিক নয়" });
      parsedDob = d;
    }

    const conflict = await User.findOne({
      phone: phone.trim(),
      _id: { $ne: decoded.id },
    });
    if (conflict)
      return res.status(409).json({ message: "এই ফোন নম্বর ইতিমধ্যে ব্যবহৃত" });

    let avatarUpdate = {};
    if (req.file) {
      const user = await User.findById(decoded.id);
      if (user?.avatar?.publicId) {
        const { deleteFromCloudinary } =
          await import("../config/cloudinary.js");
        await deleteFromCloudinary(user.avatar.publicId).catch(() => {});
      }
      const result = await uploadSingleToCloudinary(req.file, "avatars");
      avatarUpdate = {
        avatar: { url: result.secure_url, publicId: result.public_id },
      };
    }

    const eduComplete =
      educationComplete === true || educationComplete === "true";

    const update = {
      phone: phone.trim(),
      password,
      gender: gender || null,
      dateOfBirth: parsedDob,
      religion: religion || null,
      emergencyContact: emergencyContact?.trim() ?? null,
      qualification: qualification?.trim() ?? null,
      educationComplete: eduComplete ?? null,
      degree: eduComplete ? (degree ?? null) : null,
      currentYear: eduComplete === false ? (currentYear ?? null) : null,
      onboardingComplete: true,
      ...buildAddressFields(req.body),
      ...avatarUpdate,
    };

    const user = await User.findByIdAndUpdate(decoded.id, update, {
      new: true,
    }).select("-password");
    if (!user)
      return res.status(404).json({ message: "ব্যবহারকারী পাওয়া যায়নি" });

    return res.status(200).json({ success: true, user: makePayload(user) });
  } catch (err) {
    return res.status(500).json({ message: "ব্যর্থ", error: err.message });
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
export const me = async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: "লগইন করুন" });

    let decoded;
    try {
      decoded = verifyToken(token, req);
    } catch (jwtErr) {
      if (
        jwtErr.name === "TokenExpiredError" ||
        jwtErr.name === "JsonWebTokenError" ||
        jwtErr.name === "FingerprintError"
      ) {
        return res.status(401).json({ message: "সেশন মেয়াদোত্তীর্ণ" });
      }
      return res.status(503).json({ message: "সাময়িক সমস্যা" });
    }

    if (decoded.id === HARDCODED_ADMIN._id)
      return res.status(200).json({ user: makePayload(HARDCODED_ADMIN) });

    const user = await User.findById(decoded.id).select("-password");
    if (!user)
      return res.status(401).json({ message: "ব্যবহারকারী পাওয়া যায়নি" });

    return res.status(200).json({ user: makePayload(user) });
  } catch (err) {
    console.error("[me] server error:", err.message);
    return res
      .status(503)
      .json({ message: "সাময়িক সমস্যা", error: err.message });
  }
};

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
export const logout = (_req, res) => {
  return res.status(200).json({ success: true });
};

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const { phone, dateOfBirth } = req.body;
    if (!phone?.trim())
      return res.status(400).json({ message: "ফোন নম্বর দিন" });
    if (!dateOfBirth)
      return res.status(400).json({ message: "জন্ম তারিখ দিন" });

    const user = await User.findOne({ phone: phone.trim() });
    if (!user || !user.dateOfBirth)
      return res.status(404).json({ message: "তথ্য মিলছে না" });

    const storedDate = user.dateOfBirth.toISOString().split("T")[0];
    const givenDate = String(dateOfBirth).trim().split("T")[0];

    const givenMs = new Date(givenDate).getTime();
    const candidates = [
      givenDate,
      new Date(givenMs - 86_400_000).toISOString().split("T")[0],
      new Date(givenMs + 86_400_000).toISOString().split("T")[0],
    ];

    if (!candidates.includes(storedDate))
      return res
        .status(401)
        .json({ message: "ফোন নম্বর বা জন্ম তারিখ সঠিক নয়" });

    const resetToken = jwt.sign(
      { id: user._id.toString(), purpose: "password-reset" },
      JWT_SECRET,
      { expiresIn: "15m" },
    );

    return res.status(200).json({ success: true, resetToken });
  } catch (err) {
    return res.status(500).json({ message: "ব্যর্থ", error: err.message });
  }
};

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken) return res.status(400).json({ message: "টোকেন প্রয়োজন" });
    if (!newPassword || newPassword.length < 6)
      return res
        .status(400)
        .json({ message: "কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন" });

    let decoded;
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET);
    } catch {
      return res
        .status(401)
        .json({ message: "টোকেনের মেয়াদ শেষ, আবার চেষ্টা করুন" });
    }

    if (decoded.purpose !== "password-reset")
      return res.status(401).json({ message: "অবৈধ টোকেন" });

    const user = await User.findById(decoded.id);
    if (!user)
      return res.status(404).json({ message: "ব্যবহারকারী পাওয়া যায়নি" });

    user.password = newPassword;
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "পাসওয়ার্ড পরিবর্তন হয়েছে" });
  } catch (err) {
    return res.status(500).json({ message: "ব্যর্থ", error: err.message });
  }
};
