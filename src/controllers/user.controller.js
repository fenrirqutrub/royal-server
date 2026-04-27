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

// ─── GET /api/users/public ─────────────────────────────────────────────────
export const getPublicStaff = async (req, res) => {
  try {
    const users = await User.find({
      role: { $in: ["teacher", "principal", "admin"] },
    })
      .select("name role avatar slug collegeName degree")
      .sort({ createdAt: -1 });

    return res.status(200).json(users);
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ─── POST /api/users ──────────────────────────────────────────────────────────
export const createUser = async (req, res) => {
  try {
    const { name, phone, role = "teacher" } = req.body;
    const callerRole = req.user?.role; // ✅ from middleware

    if (!callerRole) return res.status(401).json({ message: "লগইন করুন" });

    if (!name?.trim() || !phone?.trim())
      return res.status(400).json({ message: "নাম ও ফোন নম্বর আবশ্যক" });

    const validRoles = ["teacher", "principal", "admin"];
    if (!validRoles.includes(role))
      return res
        .status(400)
        .json({ message: `Role must be one of: ${validRoles.join(", ")}` });

    if (!canAssign(callerRole, role))
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
      password: phone.trim(),
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

    const { name, phone, role } = req.body;
    const callerRole = req.user?.role; // ✅ from middleware

    if (!callerRole) return res.status(401).json({ message: "লগইন করুন" });

    // ✅ Only privileged roles can update users via admin panel
    const allowedCallers = ["owner", "admin", "principal"];
    if (!allowedCallers.includes(callerRole))
      return res.status(403).json({ message: "অনুমতি নেই" });

    if (role && !canAssign(callerRole, role))
      return res.status(403).json({ message: `Cannot assign role: ${role}` });

    const update = {};
    if (name) update.name = name.trim();
    if (phone) update.phone = phone.trim();
    if (role) {
      update.role = role;
      update.password = phone?.trim() ?? role;
      update.slug = await buildSlug(role, id);
    }

    const user = await User.findByIdAndUpdate(id, update, {
      new: true,
    }).select("-password");
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

    // ✅ Only privileged roles can delete
    const allowedCallers = ["owner", "admin"];
    if (!allowedCallers.includes(req.user?.role))
      return res.status(403).json({ message: "অনুমতি নেই" });

    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ Delete avatar from Cloudinary too
    if (user.avatar?.publicId)
      await deleteFromCloudinary(user.avatar.publicId).catch(() => {});

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

    // ✅ Ownership check
    const isPrivileged = ["owner", "admin"].includes(req.user?.role);
    if (!isPrivileged && req.user?.slug !== slug)
      return res
        .status(403)
        .json({ message: "নিজের প্রোফাইল ছাড়া পরিবর্তন করা যাবে না" });

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
      collegeName,
      subject,
      educationComplete,
      degree,
      currentYear,
      studentClass,
      studentSubject,
      roll,
      schoolName,
      password,
      avatar,
    } = req.body;

    // ── Conflict checks ──
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

    // ── Basic fields ──
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

    // ✅ Password — min 6 chars
    if (password && password.trim().length >= 6)
      update.password = password.trim();

    // ── Avatar (direct Cloudinary upload) ──
    if (avatar && avatar.url) {
      if (current.avatar?.publicId)
        await deleteFromCloudinary(current.avatar.publicId).catch(() => {});
      update.avatar = {
        url: avatar.url,
        publicId: avatar.publicId || null,
      };
    }

    // ── Present Address ──
    if (gramNam !== undefined) update.gramNam = gramNam?.trim() || null;
    if (para !== undefined) update.para = para?.trim() || null;
    if (thana !== undefined) update.thana = thana?.trim() || null;
    if (district !== undefined) update.district = district?.trim() || null;
    if (division !== undefined) update.division = division?.trim() || null;
    if (landmark !== undefined) update.landmark = landmark?.trim() || null;

    // ── Permanent Address ──
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

    // ── Staff Education ──
    if (collegeName !== undefined)
      update.collegeName = collegeName?.trim() || null;
    if (subject !== undefined) update.subject = subject?.trim() || null;
    if (educationComplete !== undefined)
      update.educationComplete =
        educationComplete === true || educationComplete === "true";
    if (degree !== undefined) update.degree = degree || null;
    if (currentYear !== undefined) update.currentYear = currentYear || null;

    // ── Student Education ──
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

    // ✅ Ownership check
    const isPrivileged = ["owner", "admin"].includes(req.user?.role);
    if (
      slug !== HARDCODED_ADMIN.slug &&
      !isPrivileged &&
      req.user?.slug !== slug
    )
      return res
        .status(403)
        .json({ message: "নিজের ছবি ছাড়া পরিবর্তন করা যাবে না" });

    if (slug === HARDCODED_ADMIN.slug) {
      if (HARDCODED_ADMIN.avatar?.publicId)
        await deleteFromCloudinary(HARDCODED_ADMIN.avatar.publicId).catch(
          () => {},
        );
      const result = await uploadSingleToCloudinary(req.file, "avatars");
      HARDCODED_ADMIN.avatar = {
        url: result.secure_url,
        publicId: result.public_id,
      };
      return res.status(200).json({
        success: true,
        data: makePayload(HARDCODED_ADMIN),
      });
    }

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
