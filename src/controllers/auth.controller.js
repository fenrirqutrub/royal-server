// src/controllers/auth.controller.js
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { uploadSingleToCloudinary } from "../config/cloudinary.js";
import {
  HARDCODED_ADMIN,
  STAFF_ROLES,
  ROLE_PREFIX,
} from "../constants/admin.js";

const JWT_SECRET = process.env.JWT_SECRET || "changeme-secret";
const COOKIE_NAME = "royal_token";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

// Exported so user.controller can reuse it
export const makePayload = (u) => ({
  id: u._id?.toString() ?? u._id,
  name: u.name,
  fatherName: u.fatherName ?? null,
  email: u.email ?? null,
  phone: u.phone ?? null,
  role: u.role,
  slug: u.slug ?? "",
  isHardcoded: u.isHardcoded ?? false,
  onboardingComplete: u.onboardingComplete ?? false,
  gender: u.gender ?? null,
  avatar: u.avatar ?? { url: null, publicId: null },
});

const issueToken = (res, user) => {
  const token = jwt.sign(
    { id: user._id.toString(), role: user.role, isHardcoded: false },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { phone, email, password } = req.body;
    if (!password) return res.status(400).json({ message: "পাসওয়ার্ড দিন" });
    if (!phone && !email)
      return res.status(400).json({ message: "ফোন বা ইমেইল দিন" });

    // Hardcoded owner — email only
    // auth.controller.js — login function এ এই block টা যোগ করুন
    if (phone?.trim() === HARDCODED_ADMIN.phone) {
      if (password !== HARDCODED_ADMIN.password)
        return res.status(401).json({ message: "তথ্য সঠিক নয়" });
      const token = jwt.sign(
        { id: HARDCODED_ADMIN._id, role: "owner", isHardcoded: true },
        JWT_SECRET,
        { expiresIn: "7d" },
      );
      res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
      return res
        .status(200)
        .json({ success: true, user: makePayload(HARDCODED_ADMIN) });
    }

    const query = phone
      ? { phone: phone.trim() }
      : { email: email.toLowerCase() };
    const user = await User.findOne(query);
    if (!user || user.password !== password)
      return res.status(401).json({ message: "ফোন নম্বর বা পাসওয়ার্ড ভুল" });

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role, isHardcoded: false },
      JWT_SECRET,
      { expiresIn: "7d" },
    );
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    return res.status(200).json({ success: true, user: makePayload(user) });
  } catch (err) {
    return res.status(500).json({ message: "লগইন ব্যর্থ", error: err.message });
  }
};

// ─── POST /api/auth/check-staff-phone ────────────────────────────────────────
// Step 1 of staff signup: verify phone exists as an unactivated staff record.
// Returns only { name, role } — no sensitive data.
//
// Flow:
//   Admin creates staff via POST /api/users  →  { name, phone, role, onboardingComplete: false }
//   Staff enters phone here                  →  we find that record and return name+role
//   Staff fills remaining info               →  POST /api/auth/signup activates it
export const checkStaffPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone?.trim())
      return res.status(400).json({ message: "ফোন নম্বর দিন" });

    const trimmed = phone.trim();

    // Must be: staff role + NOT yet activated
    const record = await User.findOne({
      phone: trimmed,
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
// STUDENT path  → creates a brand-new user document
// STAFF path    → finds the admin-pre-created record by phone+role,
//                 fills in the missing info, marks onboardingComplete: true,
//                 then issues a JWT cookie → auto-login
export const signup = async (req, res) => {
  try {
    const {
      name,
      fatherName,
      phone,
      password,
      gender,
      gramNam,
      dakghor,
      thana,
      jela,
      landmark,
      permanentSameAsPresent,
      permanentGramNam,
      permanentDakghor,
      permanentThana,
      permanentJela,
      role,
      studentClass,
      educationComplete,
      degree,
      currentYear,
    } = req.body;

    const isStudent = !role || role === "student";

    // ── Common required fields ────────────────────────────────────────────────
    if (!phone?.trim())
      return res.status(400).json({ message: "ফোন নম্বর দিন" });
    if (!password) return res.status(400).json({ message: "পাসওয়ার্ড দিন" });
    if (!gramNam?.trim())
      return res.status(400).json({ message: "গ্রামের নাম দিন" });
    if (!thana?.trim()) return res.status(400).json({ message: "থানা দিন" });
    if (!jela?.trim()) return res.status(400).json({ message: "জেলা দিন" });

    const trimmedPhone = phone.trim();

    // ── Avatar upload ─────────────────────────────────────────────────────────
    let avatar = { url: null, publicId: null };
    if (req.file) {
      const result = await uploadSingleToCloudinary(req.file, "avatars");
      avatar = { url: result.secure_url, publicId: result.public_id };
    }

    // ── Address helper ────────────────────────────────────────────────────────
    const isSame =
      permanentSameAsPresent === "true" || permanentSameAsPresent === true;

    const addressFields = {
      gramNam: gramNam.trim(),
      dakghor: dakghor?.trim() ?? null,
      thana: thana.trim(),
      jela: jela.trim(),
      landmark: landmark?.trim() ?? null,
      permanentSameAsPresent: isSame,
      permanentGramNam: isSame
        ? gramNam.trim()
        : (permanentGramNam?.trim() ?? null),
      permanentDakghor: isSame
        ? (dakghor?.trim() ?? null)
        : (permanentDakghor?.trim() ?? null),
      permanentThana: isSame ? thana.trim() : (permanentThana?.trim() ?? null),
      permanentJela: isSame ? jela.trim() : (permanentJela?.trim() ?? null),
    };

    // ── Shared activation fields (both student & staff) ───────────────────────
    const activationFields = {
      fatherName: fatherName?.trim() ?? null,
      password,
      gender: gender ?? null,
      avatar,
      onboardingComplete: true,
      ...addressFields,
    };

    // ════════════════════════════════════════════════════════════════════════
    // STUDENT: create new document
    // ════════════════════════════════════════════════════════════════════════
    if (isStudent) {
      if (!name?.trim()) return res.status(400).json({ message: "নাম লিখুন" });

      // phone must not exist anywhere yet
      if (await User.findOne({ phone: trimmedPhone }))
        return res
          .status(409)
          .json({ message: "এই ফোন নম্বর ইতিমধ্যে নিবন্ধিত" });

      const slug = await buildSlug("student");
      const user = await User.create({
        name: name.trim(),
        role: "student",
        phone: trimmedPhone,
        studentClass: studentClass ?? null,
        slug,
        ...activationFields,
      });

      issueToken(res, user);
      return res.status(201).json({ success: true, user: makePayload(user) });
    }

    // ════════════════════════════════════════════════════════════════════════
    // STAFF: activate the admin-pre-created record
    // The record already has { name, phone, role, onboardingComplete: false }
    // We just fill in the missing fields and flip onboardingComplete to true.
    // ════════════════════════════════════════════════════════════════════════
    if (!STAFF_ROLES.includes(role))
      return res.status(400).json({ message: "অবৈধ ভূমিকা" });

    // Find the exact unactivated record by phone + role
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

    // Apply all new fields onto the existing document and save
    Object.assign(staffRecord, activationFields, {
      // phone stays the same — already on the document, no change needed
      educationComplete: eduComplete,
      degree: eduComplete ? (degree ?? null) : null,
      currentYear: !eduComplete ? (currentYear ?? null) : null,
    });

    await staffRecord.save();

    issueToken(res, staffRecord);
    return res
      .status(200)
      .json({ success: true, user: makePayload(staffRecord) });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "নিবন্ধন ব্যর্থ", error: err.message });
  }
};

// ─── POST /api/auth/onboarding ────────────────────────────────────────────────
export const completeOnboarding = async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ message: "লগইন করুন" });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.isHardcoded)
      return res.status(403).json({ message: "প্রযোজ্য নয়" });

    const {
      phone,
      password,
      gender,
      gramNam,
      dakghor,
      thana,
      jela,
      landmark,
      permanentSameAsPresent,
      qualification,
      educationComplete,
      degree,
      currentYear,
    } = req.body;

    if (
      !phone?.trim() ||
      !password ||
      !gramNam?.trim() ||
      !thana?.trim() ||
      !jela?.trim()
    )
      return res.status(400).json({ message: "প্রয়োজনীয় তথ্য পূরণ করুন" });

    const conflict = await User.findOne({
      phone: phone.trim(),
      _id: { $ne: decoded.id },
    });
    if (conflict)
      return res.status(409).json({ message: "এই ফোন নম্বর ইতিমধ্যে ব্যবহৃত" });

    const isSame =
      permanentSameAsPresent === "true" || permanentSameAsPresent === true;

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

    const update = {
      phone: phone.trim(),
      password,
      gender: gender ?? null,
      gramNam: gramNam.trim(),
      dakghor: dakghor?.trim() ?? null,
      thana: thana.trim(),
      jela: jela.trim(),
      landmark: landmark?.trim() ?? null,
      permanentSameAsPresent: isSame,
      permanentGramNam: isSame ? gramNam.trim() : null,
      permanentThana: isSame ? thana.trim() : null,
      permanentJela: isSame ? jela.trim() : null,
      qualification: qualification?.trim() ?? null,
      educationComplete: educationComplete ?? null,
      degree: educationComplete ? (degree ?? null) : null,
      currentYear: educationComplete === false ? (currentYear ?? null) : null,
      onboardingComplete: true,
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
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ message: "লগইন করুন" });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.id === HARDCODED_ADMIN._id)
      return res.status(200).json({ user: makePayload(HARDCODED_ADMIN) });

    const user = await User.findById(decoded.id).select("-password");
    if (!user)
      return res.status(401).json({ message: "ব্যবহারকারী পাওয়া যায়নি" });

    return res.status(200).json({ user: makePayload(user) });
  } catch {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ message: "সেশন মেয়াদোত্তীর্ণ" });
  }
};

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
export const logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
  return res.status(200).json({ success: true });
};

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
