// src/controllers/teacher.controller.js
import Teacher from "../models/teacher.model.js";
import {
  uploadSingleToCloudinary,
  deleteFromCloudinary,
} from "../config/cloudinary.js";

// ─── Hardcoded super-admin ────────────────────────────────────────────────────
// ⚠️  Keep slug in sync with auth.controller.js
const HARDCODED_ADMIN = {
  _id: "hardcoded-admin",
  name: "Owner",
  email: "mib@kobita.com",
  role: "owner",
  password: "owner",
  isHardcoded: true,
  slug: "69X69",
};

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_PREFIX = { teacher: "T", principal: "P", admin: "A" };

/**
 * Which roles each caller is allowed to create / assign.
 *   super-admin  →  admin, principal, teacher
 *   admin        →  admin, principal, teacher
 *   principal    →  principal, teacher
 *   teacher      →  (none)
 */
const ROLE_PERMISSIONS = {
  "super-admin": ["admin", "principal", "teacher"],
  admin: ["admin", "principal", "teacher"],
  principal: ["principal", "teacher"],
  teacher: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detect super-admin by id OR isHardcoded flag.
 * This is the single detection point — no slug comparison needed.
 */
const resolveCallerRole = (callerId, isHardcoded) => {
  if (callerId === HARDCODED_ADMIN._id || isHardcoded === true)
    return "super-admin";
  return null; // will fall back to callerRole from body
};

const canAssign = (effectiveCallerRole, targetRole) =>
  (ROLE_PERMISSIONS[effectiveCallerRole] ?? []).includes(targetRole);

const buildSlug = async (role, excludeId = null) => {
  const prefix = ROLE_PREFIX[role] ?? role[0].toUpperCase();
  const year = String(new Date().getFullYear()).slice(-2);

  // Find the highest existing sequence number for this role and keep incrementing
  // until we find a slug that doesn't exist — handles gaps from deleted docs
  const existing = await Teacher.find(
    { slug: { $regex: `^${prefix}${year}` } },
    { slug: 1 },
  ).lean();

  const usedNums = new Set(
    existing
      .map((t) => parseInt(t.slug?.slice(-2) ?? "0", 10))
      .filter((n) => !isNaN(n)),
  );

  let seq = 1;
  while (usedNums.has(seq)) seq++;

  return `${prefix}${year}${String(seq).padStart(2, "0")}`;
};

const migrateMissingSlugs = async () => {
  const docs = await Teacher.find({ slug: { $exists: false } });
  for (const doc of docs) {
    try {
      const slug = await buildSlug(doc.role);
      await Teacher.findByIdAndUpdate(doc._id, { slug });
    } catch (_) {
      /* skip collision */
    }
  }
};

// ─── GET /api/teachers ────────────────────────────────────────────────────────
export const getTeachers = async (req, res) => {
  try {
    await migrateMissingSlugs();

    const teachers = await Teacher.find()
      .select("-password")
      .sort({ createdAt: -1 });

    const alreadyInDB = teachers.some((t) => t.email === HARDCODED_ADMIN.email);
    const { password: _pw, ...safeAdmin } = HARDCODED_ADMIN;
    const list = alreadyInDB ? teachers : [safeAdmin, ...teachers];

    return res.status(200).json(list);
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ─── POST /api/teachers ───────────────────────────────────────────────────────
export const createTeacher = async (req, res) => {
  try {
    const {
      name,
      email,
      role = "teacher",
      callerId, // id of the logged-in user
      callerRole, // role string from frontend
      isHardcoded, // boolean flag from frontend
    } = req.body;

    if (!name?.trim() || !email?.trim())
      return res.status(400).json({ message: "Name and email are required" });

    const validRoles = ["teacher", "principal", "admin"];
    if (!validRoles.includes(role))
      return res
        .status(400)
        .json({ message: `Role must be one of: ${validRoles.join(", ")}` });

    // Resolve effective caller role
    const effectiveCaller =
      resolveCallerRole(callerId, isHardcoded) ?? callerRole ?? "teacher";

    if (!canAssign(effectiveCaller, role))
      return res.status(403).json({
        message: `A ${effectiveCaller} cannot create a ${role}`,
      });

    const slug = await buildSlug(role);
    const teacher = await Teacher.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      password: role,
      slug,
    });

    const { password: _pw, ...safe } = teacher.toObject();
    return res.status(201).json(safe);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "Email already exists" });
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ─── PATCH /api/teachers/:id ──────────────────────────────────────────────────
export const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === HARDCODED_ADMIN._id)
      return res.status(403).json({ message: "Cannot modify hardcoded admin" });

    const { name, email, role, callerId, callerRole, isHardcoded } = req.body;

    if (role) {
      const effectiveCaller =
        resolveCallerRole(callerId, isHardcoded) ?? callerRole ?? "teacher";
      if (!canAssign(effectiveCaller, role))
        return res.status(403).json({
          message: `A ${effectiveCaller} cannot assign the ${role} role`,
        });
    }

    const update = {};
    if (name) update.name = name.trim();
    if (email) update.email = email.trim().toLowerCase();
    if (role) {
      update.role = role;
      update.password = role;
      update.slug = await buildSlug(role, id);
    }

    const teacher = await Teacher.findByIdAndUpdate(id, update, {
      new: true,
    }).select("-password");
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    return res.status(200).json(teacher);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "Email already exists" });
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ─── DELETE /api/teachers/:id ─────────────────────────────────────────────────
export const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === HARDCODED_ADMIN._id)
      return res.status(403).json({ message: "Cannot delete hardcoded admin" });

    const teacher = await Teacher.findByIdAndDelete(id);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    return res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ─── GET /api/teachers/:slug/profile ─────────────────────────────────────────
export const getProfile = async (req, res) => {
  try {
    const { slug } = req.params;

    if (slug === HARDCODED_ADMIN.slug) {
      const { password: _pw, ...safe } = HARDCODED_ADMIN;
      return res.status(200).json({ success: true, data: safe });
    }

    const teacher = await Teacher.findOne({ slug }).select("-password");
    if (!teacher) return res.status(404).json({ message: "Profile not found" });

    return res.status(200).json({ success: true, data: teacher });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ─── PATCH /api/teachers/:slug/profile ───────────────────────────────────────
export const updateProfile = async (req, res) => {
  try {
    const { slug } = req.params;

    if (slug === HARDCODED_ADMIN.slug)
      return res.status(403).json({ message: "Cannot modify hardcoded admin" });

    const { name, phone, address } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    if (phone !== undefined) update.phone = phone?.trim() || null;
    if (address !== undefined) update.address = address?.trim() || null;

    const teacher = await Teacher.findOneAndUpdate({ slug }, update, {
      new: true,
    }).select("-password");
    if (!teacher) return res.status(404).json({ message: "Profile not found" });

    return res.status(200).json({ success: true, data: teacher });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ─── POST /api/teachers/:slug/avatar ─────────────────────────────────────────
export const updateAvatar = async (req, res) => {
  try {
    const { slug } = req.params;

    if (slug === HARDCODED_ADMIN.slug)
      return res.status(403).json({ message: "Cannot modify hardcoded admin" });

    if (!req.file)
      return res.status(400).json({ message: "No image file provided" });

    const teacher = await Teacher.findOne({ slug });
    if (!teacher) return res.status(404).json({ message: "Profile not found" });

    if (teacher.avatar?.publicId)
      await deleteFromCloudinary(teacher.avatar.publicId).catch(() => {});

    const result = await uploadSingleToCloudinary(req.file, "avatars");
    teacher.avatar = { url: result.secure_url, publicId: result.public_id };
    await teacher.save();

    const { password: _pw, ...safe } = teacher.toObject();
    return res.status(200).json({ success: true, data: safe });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ─── POST /api/teachers/login ─────────────────────────────────────────────────
export const loginTeacher = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });

    if (
      email.toLowerCase() === HARDCODED_ADMIN.email &&
      password === HARDCODED_ADMIN.password
    ) {
      return res.status(200).json({
        success: true,
        user: {
          id: HARDCODED_ADMIN._id,
          email: HARDCODED_ADMIN.email,
          name: HARDCODED_ADMIN.name,
          role: HARDCODED_ADMIN.role,
          slug: HARDCODED_ADMIN.slug,
          isHardcoded: true,
        },
      });
    }

    const teacher = await Teacher.findOne({ email: email.toLowerCase() });
    if (!teacher || teacher.password !== password)
      return res.status(401).json({ message: "Invalid credentials" });

    return res.status(200).json({
      success: true,
      user: {
        id: teacher._id.toString(),
        email: teacher.email,
        name: teacher.name,
        role: teacher.role,
        slug: teacher.slug ?? "",
        isHardcoded: false,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};
