import { uploadToCloudinary } from "../config/cloudinary.js";
import TeacherProfile from "../models/teacher.model.js"; // ✅ correct path

export const getProfile = async (req, res) => {
  try {
    const profile = await TeacherProfile.findOne();
    return res
      .status(200)
      .json(profile ?? { nickname: "Teacher", avatarUrl: null });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided" });

    const result = await uploadToCloudinary(
      req.file.buffer,
      "teacher-profiles",
    );

    let profile = await TeacherProfile.findOne();
    if (profile) {
      profile.avatarUrl = result.secure_url;
      await profile.save();
    } else {
      profile = await TeacherProfile.create({ avatarUrl: result.secure_url });
    }

    return res
      .status(200)
      .json({ url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    console.error("uploadAvatar error:", err);
    return res
      .status(500)
      .json({ message: "Upload failed", error: err.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { nickname } = req.body;
    if (!nickname?.trim())
      return res.status(400).json({ message: "Invalid nickname" });

    let profile = await TeacherProfile.findOne();
    if (profile) {
      profile.nickname = nickname.trim();
      await profile.save();
    } else {
      profile = await TeacherProfile.create({ nickname: nickname.trim() });
    }

    return res.status(200).json({ success: true, nickname: profile.nickname });
  } catch (err) {
    console.error("updateProfile error:", err);
    return res
      .status(500)
      .json({ message: "Update failed", error: err.message });
  }
};
