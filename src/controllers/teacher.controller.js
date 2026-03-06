// src/controllers/teacher.controller.js
import Teacher from "../models/teacher.model.js";
import {
  uploadSingleToCloudinary,
  deleteFromCloudinary,
} from "../config/cloudinary.js";

// ─── Hardcoded admin ──────────────────────────────────────────────────────────
const HARDCODED_ADMIN = {
  _id: "hardcoded-admin",
  name: "Super Admin",
  email: "hello@world.com",
  role: "admin",
  password: "admin",
  isHardcoded: true,
  slug: "A2601",
};

// ─── Slug generator ───────────────────────────────────────────────────────────
const ROLE_PREFIX = { teacher: "T", principal: "P", admin: "A" };

const generateSlug = async (role) => {
  const prefix = ROLE_PREFIX[role] ?? role[0].toUpperCase();
  const year = String(new Date().getFullYear()).slice(-2);
  const count = await Teacher.countDocuments({ role });
  const seq = String(count + 1).padStart(2, "0");
  return `${prefix}${year}${seq}`;
};

// ─── Migration helper ─────────────────────────────────────────────────────────
const migrateMissingSlugs = async () => {
  const withoutSlug = await Teacher.find({ slug: { $exists: false } });
  if (withoutSlug.length === 0) return;
  for (const doc of withoutSlug) {
    try {
      const existing = await Teacher.countDocuments({
        role: doc.role,
        slug: { $exists: true },
      });
      const padded = String(existing + 1).padStart(2, "0");
      const prefix = ROLE_PREFIX[doc.role] ?? doc.role[0].toUpperCase();
      const year = String(new Date().getFullYear()).slice(-2);
      await Teacher.findByIdAndUpdate(doc._id, {
        slug: `${prefix}${year}${padded}`,
      });
    } catch (_) {}
  }
};

// ── GET /api/teachers ─────────────────────────────────────────────────────────
export const getTeachers = async (req, res) => {
  try {
    await migrateMissingSlugs();
    const teachers = await Teacher.find()
      .select("-password")
      .sort({ createdAt: -1 });
    const alreadyInDB = teachers.some((t) => t.email === HARDCODED_ADMIN.email);
    const { password: _, ...safeAdmin } = HARDCODED_ADMIN;
    const list = alreadyInDB ? teachers : [safeAdmin, ...teachers];
    return res.status(200).json(list);
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ── GET /api/teachers/:slug/profile ──────────────────────────────────────────
export const getProfile = async (req, res) => {
  try {
    const { slug } = req.params;

    // Hardcoded admin
    if (slug === HARDCODED_ADMIN.slug) {
      const { password: _, ...safe } = HARDCODED_ADMIN;
      return res.status(200).json({ success: true, data: safe });
    }

    const teacher = await Teacher.findOne({ slug }).select("-password");
    if (!teacher) return res.status(404).json({ message: "Profile not found" });
    return res.status(200).json({ success: true, data: teacher });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ── PATCH /api/teachers/:slug/profile ────────────────────────────────────────
// Updates name, phone, address. Avatar handled separately via /avatar route.
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

// ── POST /api/teachers/:slug/avatar ──────────────────────────────────────────
export const updateAvatar = async (req, res) => {
  try {
    const { slug } = req.params;

    if (slug === HARDCODED_ADMIN.slug)
      return res.status(403).json({ message: "Cannot modify hardcoded admin" });

    if (!req.file)
      return res.status(400).json({ message: "No image file provided" });

    const teacher = await Teacher.findOne({ slug });
    if (!teacher) return res.status(404).json({ message: "Profile not found" });

    // Delete old avatar from Cloudinary if exists
    if (teacher.avatar?.publicId) {
      await deleteFromCloudinary(teacher.avatar.publicId).catch(() => {});
    }

    // Upload new avatar
    const result = await uploadSingleToCloudinary(req.file, "avatars");
    teacher.avatar = { url: result.secure_url, publicId: result.public_id };
    await teacher.save();

    const { password: _, ...safe } = teacher.toObject();
    return res.status(200).json({ success: true, data: safe });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ── POST /api/teachers ────────────────────────────────────────────────────────
export const createTeacher = async (req, res) => {
  try {
    const { name, email, role = "teacher" } = req.body;
    if (!name?.trim() || !email?.trim())
      return res.status(400).json({ message: "Name and email are required" });

    const allowed = ["teacher", "principal", "admin"];
    if (!allowed.includes(role))
      return res
        .status(400)
        .json({ message: `Role must be one of: ${allowed.join(", ")}` });

    const slug = await generateSlug(role);
    const teacher = await Teacher.create({
      name,
      email,
      role,
      password: role,
      slug,
    });
    const { password: _p, ...safe } = teacher.toObject();
    return res.status(201).json(safe);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "Email already exists" });
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ── PATCH /api/teachers/:id ───────────────────────────────────────────────────
export const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === "hardcoded-admin")
      return res.status(403).json({ message: "Cannot modify hardcoded admin" });

    const { name, email, role } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    const emailVal = email?.trim().toLowerCase();
    if (emailVal) update.email = emailVal;

    if (role) {
      update.role = role;
      update.password = role;
      const prefix = ROLE_PREFIX[role] ?? role[0].toUpperCase();
      const year = String(new Date().getFullYear()).slice(-2);
      const count = await Teacher.countDocuments({
        role,
        _id: { $ne: id },
        slug: { $exists: true },
      });
      update.slug = `${prefix}${year}${String(count + 1).padStart(2, "0")}`;
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

// ── DELETE /api/teachers/:id ──────────────────────────────────────────────────
export const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === "hardcoded-admin")
      return res.status(403).json({ message: "Cannot delete hardcoded admin" });
    const teacher = await Teacher.findByIdAndDelete(id);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    return res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ── POST /api/teachers/login ──────────────────────────────────────────────────
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
          email: HARDCODED_ADMIN.email,
          name: HARDCODED_ADMIN.name,
          role: HARDCODED_ADMIN.role,
          slug: HARDCODED_ADMIN.slug,
        },
      });
    }

    const teacher = await Teacher.findOne({ email: email.toLowerCase() });
    if (!teacher || teacher.password !== password)
      return res.status(401).json({ message: "Invalid credentials" });

    return res.status(200).json({
      success: true,
      user: {
        email: teacher.email,
        name: teacher.name,
        role: teacher.role,
        slug: teacher.slug,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};
