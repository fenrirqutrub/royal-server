// src/controllers/weekly.exam.controller.js
import WeeklyExam from "../models/weekly.exam.model.js";
import { uploadMultipleToCloudinary } from "../config/cloudinary.js";
import dotenv from "dotenv";
dotenv.config();

// ─── helpers ──────────────────────────────────────────────
const generateSlug = ({ cls, ExamNumber }) =>
  `weekly-exam-${ExamNumber}-${cls}`
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0980-\u09FF-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getAllWeeklyExams = async (req, res) => {
  try {
    const { teacherSlug } = req.query;

    const filter = teacherSlug ? { teacherSlug } : {};
    const exams = await WeeklyExam.find(filter).sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: exams });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET by slug ──────────────────────────────────────────
export const getWeeklyExamBySlug = async (req, res) => {
  try {
    const exam = await WeeklyExam.findOne({ slug: req.params.slug });
    if (!exam)
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    res.status(200).json({ success: true, data: exam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST create ──────────────────────────────────────────
export const createWeeklyExam = async (req, res) => {
  try {
    const {
      subject,
      teacher,
      teacherSlug, // ✅ accept from request body
      class: cls,
      mark,
      ExamNumber,
      topics,
    } = req.body;

    if (!subject || !teacher || !cls || !mark || !ExamNumber || !topics) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
        received: { subject, teacher, class: cls, mark, ExamNumber, topics },
      });
    }

    if (topics.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: "Topics must be at least 20 characters",
      });
    }

    // Upload images if provided
    let images = [];
    if (req.files && req.files.length > 0) {
      const uploaded = await uploadMultipleToCloudinary(
        req.files,
        "weekly-exams",
      );
      images = uploaded.map((r) => ({
        imageUrl: r.secure_url,
        publicId: r.public_id,
      }));
    }

    // Generate unique slug
    let slug = generateSlug({ cls, ExamNumber });
    const existing = await WeeklyExam.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const exam = await WeeklyExam.create({
      slug,
      subject,
      teacher,
      teacherSlug: teacherSlug ?? null, // ✅ save teacher slug
      class: cls,
      mark: Number(mark),
      ExamNumber,
      topics,
      images,
    });

    res.status(201).json({ success: true, data: exam });
  } catch (err) {
    if (err.code === 11000)
      return res
        .status(409)
        .json({ success: false, message: "Duplicate exam entry" });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT update ───────────────────────────────────────────
export const updateWeeklyExam = async (req, res) => {
  try {
    const { class: cls, ExamNumber } = req.body;

    if (cls || ExamNumber) {
      const current = await WeeklyExam.findById(req.params.id);
      if (!current)
        return res
          .status(404)
          .json({ success: false, message: "Exam not found" });

      req.body.slug = generateSlug({
        cls: cls || current.class,
        ExamNumber: ExamNumber || current.ExamNumber,
      });
    }

    // Upload new images if provided
    if (req.files && req.files.length > 0) {
      const uploaded = await uploadMultipleToCloudinary(
        req.files,
        "weekly-exams",
      );
      req.body.images = uploaded.map((r) => ({
        imageUrl: r.secure_url,
        publicId: r.public_id,
      }));
    }

    const exam = await WeeklyExam.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!exam)
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });

    res.status(200).json({ success: true, data: exam });
  } catch (err) {
    if (err.code === 11000)
      return res
        .status(409)
        .json({ success: false, message: "Slug conflict on update" });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE ───────────────────────────────────────────────
export const deleteWeeklyExam = async (req, res) => {
  try {
    const exam = await WeeklyExam.findByIdAndDelete(req.params.id);
    if (!exam)
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    res
      .status(200)
      .json({ success: true, message: "Exam deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
