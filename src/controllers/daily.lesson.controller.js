// src/controllers/daily.lesson.controller.js

import DailyLesson from "../models/daily.lesson.model.js";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

// ── Cloudinary stream upload helper ──────────────────────────────────────────
const uploadToCloudinary = (buffer, folder = "daily-lessons") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream((error, result) =>
      error ? reject(error) : resolve(result),
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

// ── POST /api/daily-lesson ────────────────────────────────────────────────────
export const createDailyLesson = async (req, res) => {
  try {
    const {
      subject,
      teacher,
      teacherSlug,
      class: cls,
      mark,
      chapterNumber,
      topics,
      slug,
    } = req.body;

    const lesson = await DailyLesson.create({
      subject,
      teacher,
      teacherSlug: teacherSlug || null,
      class: cls,
      mark: mark ? Number(mark) : 0,
      chapterNumber,
      topics,
      slug: slug || null,
    });

    res.status(201).json({ success: true, data: lesson });
  } catch (err) {
    console.error("❌ createDailyLesson:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/daily-lesson ─────────────────────────────────────────────────────
export const getAllDailyLessons = async (req, res) => {
  try {
    const { class: cls, subject, teacherSlug } = req.query;
    const filter = {};
    if (cls) filter.class = cls;
    if (subject) filter.subject = subject;
    if (teacherSlug) filter.teacherSlug = teacherSlug;

    const lessons = await DailyLesson.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: lessons });
  } catch (err) {
    console.error("❌ getAllDailyLessons:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/daily-lesson/:id ─────────────────────────────────────────────────
export const getDailyLessonById = async (req, res) => {
  try {
    const lesson = await DailyLesson.findById(req.params.id);
    if (!lesson)
      return res
        .status(404)
        .json({ success: false, message: "Lesson not found" });
    res.json({ success: true, data: lesson });
  } catch (err) {
    console.error("❌ getDailyLessonById:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PATCH /api/daily-lesson/:id ───────────────────────────────────────────────
export const updateDailyLesson = async (req, res) => {
  try {
    const lesson = await DailyLesson.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!lesson)
      return res
        .status(404)
        .json({ success: false, message: "Lesson not found" });
    res.json({ success: true, data: lesson });
  } catch (err) {
    console.error("❌ updateDailyLesson:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /api/daily-lesson/:id ──────────────────────────────────────────────
export const deleteDailyLesson = async (req, res) => {
  try {
    const lesson = await DailyLesson.findById(req.params.id);
    if (!lesson)
      return res
        .status(404)
        .json({ success: false, message: "Lesson not found" });

    await lesson.deleteOne();
    res.json({ success: true, message: "Lesson deleted successfully" });
  } catch (err) {
    console.error("❌ deleteDailyLesson:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
