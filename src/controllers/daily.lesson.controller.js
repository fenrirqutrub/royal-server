// src/controllers/daily.lesson.controller.js

import mongoose from "mongoose";
import DailyLesson from "../models/daily.lesson.model.js";

// ── POST /api/daily-lesson ──────────────────────────────────────
export const createDailyLesson = async (req, res) => {
  try {
    const {
      subject,
      teacher,
      teacherSlug,
      class: cls,
      mark,
      referenceType,
      chapterNumber,
      topics,
      slug,
      date,
    } = req.body;

    // createDailyLesson — add this before DailyLesson.create()
    if (!teacher || !mongoose.isValidObjectId(teacher)) {
      return res.status(400).json({
        success: false,
        message: "Valid teacher ID is required",
      });
    }

    const lesson = await DailyLesson.create({
      subject,
      teacher,
      teacherSlug: teacherSlug || null,
      class: cls,
      mark: mark ? Number(mark) : 0,
      referenceType: referenceType === "page" ? "page" : "chapter",
      chapterNumber,
      topics,
      slug: slug || null,
      date: date ? new Date(date) : new Date(),
    });

    // create এর পর populate করে return করো
    const populated = await DailyLesson.findById(lesson._id).populate(
      "teacher",
      "name avatar role slug",
    );

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error("❌ createDailyLesson:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/daily-lesson ───────────────────────────────────────
export const getAllDailyLessons = async (req, res) => {
  try {
    const lessons = await DailyLesson.find()
      .populate("teacher", "name avatar role slug")
      .populate("viewedBy.userId", "name studentClass roll avatar role") // ✅ যোগ করো
      .sort({ createdAt: -1 });
    res.json({ success: true, data: lessons });
  } catch (err) {
    console.error("❌ getAllDailyLessons:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/daily-lesson/:id ───────────────────────────────────
export const getDailyLessonById = async (req, res) => {
  try {
    const lesson = await DailyLesson.findById(req.params.id).populate(
      "teacher",
      "name avatar role slug",
    );
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

// ── PATCH /api/daily-lesson/:id ─────────────────────────────────
export const updateDailyLesson = async (req, res) => {
  try {
    const body = req.body ?? {};
    const updateFields = {};

    if (body.subject) updateFields.subject = body.subject;
    if (body.class) updateFields.class = body.class;
    if (body.chapterNumber) updateFields.chapterNumber = body.chapterNumber;
    if (body.topics) updateFields.topics = body.topics;
    if (body.teacher) updateFields.teacher = body.teacher; // ← ObjectId
    if (body.referenceType)
      updateFields.referenceType =
        body.referenceType === "page" ? "page" : "chapter";
    if (body.teacherSlug !== undefined)
      updateFields.teacherSlug = body.teacherSlug || null;
    if (body.date) updateFields.date = new Date(body.date);

    if (Object.keys(updateFields).length === 0)
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });

    const lesson = await DailyLesson.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true },
    ).populate("teacher", "name avatar role slug");

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

// ── DELETE /api/daily-lesson/:id ────────────────────────────────
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

// ✅ নতুন function যোগ করো
export const recordDailyLessonView = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "অনুমতি নেই" });
    }

    const lesson = await DailyLesson.findByIdAndUpdate(
      id,
      {
        $push: { viewedBy: { userId, viewedAt: new Date() } },
        $inc: { viewCount: 1 },
      },
      { new: true },
    )
      .populate("teacher", "name avatar role slug")
      .populate("viewedBy.userId", "name studentClass roll avatar role");

    if (!lesson) {
      return res.status(404).json({ message: "পাঠ পাওয়া যায়নি" });
    }

    return res.status(200).json({
      success: true,
      viewCount: lesson.viewCount,
      viewedBy: lesson.viewedBy.filter((v) => v.userId),
    });
  } catch (err) {
    console.error("recordDailyLessonView error:", err);
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};
