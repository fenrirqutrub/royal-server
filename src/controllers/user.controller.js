// src/controllers/user.controller.js
import User from "../models/user.model.js";
import { buildSlug, makePayload } from "./auth.controller.js";
import {
  uploadSingleToCloudinary,
  deleteFromCloudinary,
} from "../config/cloudinary.js";
import { HARDCODED_ADMIN, ROLE_PERMISSIONS } from "../constants/admin.js";

const canAssign = (callerRole, targetRole) =>
  (ROLE_PERMISSIONS[callerRole] ?? []).includes(targetRole);

// ─── GET /api/users ───────────────────────────────────────────────────────────
export const getUsers = async (req, res) => {
  try {
    const filter = req.query.role ? { role: req.query.role } : {};
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });
    const alreadyInDB = users.some((u) => u.email === HARDCODED_ADMIN.email);
    return res
      .status(200)
      .json(alreadyInDB ? users : [HARDCODED_ADMIN, ...users]);
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ─── POST /api/users ──────────────────────────────────────────────────────────
export const createUser = async (req, res) => {
  try {
    const { name, phone, role = "teacher", callerRole } = req.body;

    if (!name?.trim() || !phone?.trim())
      return res.status(400).json({ message: "নাম ও ফোন নম্বর আবশ্যক" });

    const validRoles = ["teacher", "principal", "admin"];
    if (!validRoles.includes(role))
      return res
        .status(400)
        .json({ message: `Role must be one of: ${validRoles.join(", ")}` });

    if (!canAssign(callerRole ?? "teacher", role))
      return res
        .status(403)
        .json({ message: `A ${callerRole} cannot create a ${role}` });

    if (await User.findOne({ phone: phone.trim() }))
      return res.status(409).json({ message: "এই ফোন নম্বর ইতিমধ্যে ব্যবহৃত" });

    const slug = await buildSlug(role);
    const user = await User.create({
      name: name.trim(),
      phone: phone.trim(),
      role,
      password: phone.trim(), // temp — hashed by pre-save hook
      slug,
      onboardingComplete: false,
    });

    const { password: _pw, ...safe } = user.toObject();
    return res.status(201).json(safe);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "এই ফোন নম্বর ইতিমধ্যে ব্যবহৃত" });
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ─── PATCH /api/users/:id ─────────────────────────────────────────────────────
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === HARDCODED_ADMIN._id)
      return res.status(403).json({ message: "Cannot modify hardcoded admin" });

    const { name, phone, role, callerRole } = req.body;

    if (role && !canAssign(callerRole ?? "teacher", role))
      return res.status(403).json({ message: `Cannot assign role: ${role}` });

    const update = {};
    if (name) update.name = name.trim();
    if (phone) update.phone = phone.trim();
    if (role) {
      update.role = role;
      update.password = phone?.trim() ?? role;
      update.slug = await buildSlug(role, id);
    }

    const user = await User.findByIdAndUpdate(id, update, { new: true }).select(
      "-password",
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json(user);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "এই ফোন নম্বর ইতিমধ্যে ব্যবহৃত" });
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === HARDCODED_ADMIN._id)
      return res.status(403).json({ message: "Cannot delete hardcoded admin" });

    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ─── GET /api/users/:slug/profile ─────────────────────────────────────────────
export const getProfile = async (req, res) => {
  try {
    const { slug } = req.params;
    if (slug === HARDCODED_ADMIN.slug)
      return res.status(200).json({ success: true, data: HARDCODED_ADMIN });

    const user = await User.findOne({ slug }).select("-password");
    if (!user) return res.status(404).json({ message: "Profile not found" });

    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ─── PATCH /api/users/:slug/profile ──────────────────────────────────────────
export const updateProfile = async (req, res) => {
  try {
    const { slug } = req.params;
    if (slug === HARDCODED_ADMIN.slug)
      return res.status(403).json({ message: "Cannot modify hardcoded admin" });

    const current = await User.findOne({ slug });
    if (!current) return res.status(404).json({ message: "Profile not found" });

    const {
      name,
      fatherName,
      motherName,
      phone,
      email,
      gender,
      dateOfBirth,
      religion,
      emergencyContact,
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
      qualification,
      educationComplete,
      degree,
      currentYear,
      studentClass,
      studentSubject,
      roll,
      schoolName,
      password,
    } = req.body;

    if (email) {
      const conflict = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: current._id },
      });
      if (conflict)
        return res.status(409).json({ message: "এই ইমেইল ইতিমধ্যে ব্যবহৃত" });
    }
    if (phone) {
      const conflict = await User.findOne({
        phone: phone.trim(),
        _id: { $ne: current._id },
      });
      if (conflict)
        return res
          .status(409)
          .json({ message: "এই ফোন নম্বর ইতিমধ্যে ব্যবহৃত" });
    }

    const isSame =
      permanentSameAsPresent === true || permanentSameAsPresent === "true";
    const update = {};

    if (name !== undefined) update.name = name.trim();
    if (fatherName !== undefined)
      update.fatherName = fatherName?.trim() || null;
    if (motherName !== undefined)
      update.motherName = motherName?.trim() || null;
    if (phone !== undefined) update.phone = phone?.trim() || null;
    if (email !== undefined) update.email = email?.toLowerCase().trim() || null;
    if (gender !== undefined) update.gender = gender || null;
    if (dateOfBirth !== undefined)
      update.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (religion !== undefined) update.religion = religion || null;
    if (emergencyContact !== undefined)
      update.emergencyContact = emergencyContact?.trim() || null;
    if (password) update.password = password;

    if (gramNam !== undefined) update.gramNam = gramNam?.trim() || null;
    if (para !== undefined) update.para = para?.trim() || null;
    if (thana !== undefined) update.thana = thana?.trim() || null;
    if (district !== undefined) update.district = district?.trim() || null;
    if (division !== undefined) update.division = division?.trim() || null;
    if (landmark !== undefined) update.landmark = landmark?.trim() || null;

    if (permanentSameAsPresent !== undefined) {
      update.permanentSameAsPresent = isSame;
      update.permanentGramNam = isSame
        ? (gramNam?.trim() ?? current.gramNam)
        : (permanentGramNam?.trim() ?? null);
      update.permanentPara = isSame
        ? (para?.trim() ?? current.para)
        : (permanentPara?.trim() ?? null);
      update.permanentThana = isSame
        ? (thana?.trim() ?? current.thana)
        : (permanentThana?.trim() ?? null);
      update.permanentDistrict = isSame
        ? (district?.trim() ?? current.district)
        : (permanentDistrict?.trim() ?? null);
      update.permanentDivision = isSame
        ? (division?.trim() ?? current.division)
        : (permanentDivision?.trim() ?? null);
    } else {
      if (permanentGramNam !== undefined)
        update.permanentGramNam = permanentGramNam?.trim() || null;
      if (permanentPara !== undefined)
        update.permanentPara = permanentPara?.trim() || null;
      if (permanentThana !== undefined)
        update.permanentThana = permanentThana?.trim() || null;
      if (permanentDistrict !== undefined)
        update.permanentDistrict = permanentDistrict?.trim() || null;
      if (permanentDivision !== undefined)
        update.permanentDivision = permanentDivision?.trim() || null;
    }

    if (qualification !== undefined)
      update.qualification = qualification?.trim() || null;
    if (educationComplete !== undefined)
      update.educationComplete = educationComplete;
    if (degree !== undefined) update.degree = degree ?? null;
    if (currentYear !== undefined) update.currentYear = currentYear ?? null;

    const CLASSES_WITH_SUBJECT = [
      "নবম শ্রেণি",
      "দশম শ্রেণি",
      "একাদশ শ্রেণি",
      "দ্বাদশ শ্রেণি",
    ];
    if (studentClass !== undefined) update.studentClass = studentClass ?? null;
    if (studentSubject !== undefined)
      update.studentSubject = studentSubject ?? null;
    if (
      studentClass !== undefined &&
      !CLASSES_WITH_SUBJECT.includes(studentClass)
    )
      update.studentSubject = null;
    if (roll !== undefined) update.roll = roll?.trim() || null;
    if (schoolName !== undefined)
      update.schoolName = schoolName?.trim() || null;

    const user = await User.findOneAndUpdate({ slug }, update, {
      new: true,
    }).select("-password");
    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "এই তথ্য ইতিমধ্যে ব্যবহৃত" });
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ─── POST /api/users/:slug/avatar ─────────────────────────────────────────────
export const updateAvatar = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!req.file)
      return res.status(400).json({ message: "No image file provided" });

    // ── Hardcoded owner: upload to Cloudinary, update in-memory object ────────
    if (slug === HARDCODED_ADMIN.slug) {
      // Delete old avatar if exists
      if (HARDCODED_ADMIN.avatar?.publicId) {
        await deleteFromCloudinary(HARDCODED_ADMIN.avatar.publicId).catch(
          () => {},
        );
      }

      const result = await uploadSingleToCloudinary(req.file, "avatars");
      // Mutate the in-memory HARDCODED_ADMIN so /api/auth/me returns updated avatar
      HARDCODED_ADMIN.avatar = {
        url: result.secure_url,
        publicId: result.public_id,
      };

      return res.status(200).json({
        success: true,
        data: makePayload(HARDCODED_ADMIN),
      });
    }

    // ── Normal DB user ─────────────────────────────────────────────────────────
    const user = await User.findOne({ slug });
    if (!user) return res.status(404).json({ message: "Profile not found" });

    if (user.avatar?.publicId)
      await deleteFromCloudinary(user.avatar.publicId).catch(() => {});

    const result = await uploadSingleToCloudinary(req.file, "avatars");
    user.avatar = { url: result.secure_url, publicId: result.public_id };
    await user.save();

    const { password: _pw, ...safe } = user.toObject();
    return res.status(200).json({ success: true, data: safe });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};
