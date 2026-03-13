// src/controllers/weekly.exam.controller.js
import WeeklyExam from "../models/weekly.exam.model.js";
import Teacher from "../models/teacher.model.js";
import {
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
} from "../config/cloudinary.js";

// ── helper: resolve teacherSlug from name if not provided ────────────────────
const resolveTeacherSlug = async (rawSlug, teacherName) => {
  if (rawSlug) return rawSlug;
  if (!teacherName) return null;
  const found = await Teacher.findOne({
    name: { $regex: new RegExp(`^${teacherName.trim()}$`, "i") },
  }).select("slug");
  return found?.slug ?? null;
};

// ── helper: build slug ────────────────────────────────────
const buildSlug = (ExamNumber, cls, subject, teacherSlug) =>
  `${ExamNumber}-${cls}-${subject}-${teacherSlug}`.replace(/\s+/g, "-");

// ── auto-migration: runs on every GET, fixes any wrong/missing slugs ─────────
const migrateMissingSlugs = async () => {
  const docs = await WeeklyExam.find({});

  for (const doc of docs) {
    try {
      const teacherSlug =
        doc.teacherSlug ?? (await resolveTeacherSlug(null, doc.teacher));
      const correctSlug = buildSlug(
        doc.ExamNumber,
        doc.class,
        doc.subject,
        teacherSlug ?? doc._id.toString().slice(-4),
      );

      // only update if something is wrong
      if (doc.slug !== correctSlug || doc.teacherSlug !== teacherSlug) {
        await WeeklyExam.findByIdAndUpdate(doc._id, {
          slug: correctSlug,
          teacherSlug,
        });
      }
    } catch (_) {}
  }
};

// ── GET /api/weekly-exams ─────────────────────────────────
export const getAllWeeklyExams = async (req, res) => {
  try {
    await migrateMissingSlugs();
    const filter = {};
    if (req.query.teacherSlug) {
      filter.teacherSlug = req.query.teacherSlug;
    }
    const exams = await WeeklyExam.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(exams);
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ── GET /api/weekly-exams/:slug ───────────────────────────
export const getWeeklyExamBySlug = async (req, res) => {
  try {
    const exam = await WeeklyExam.findOne({ slug: req.params.slug });
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    return res.status(200).json(exam);
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ── POST /api/weekly-exams ────────────────────────────────
export const createWeeklyExam = async (req, res) => {
  try {
    let {
      subject,
      teacher,
      teacherSlug: rawSlug,
      class: cls,
      mark,
      ExamNumber,
      topics,
    } = req.body;

    // resolve teacherSlug; if teacher name is empty, look it up from slug
    const teacherSlug = await resolveTeacherSlug(rawSlug, teacher);
    if (!teacher?.trim() && teacherSlug) {
      const found = await Teacher.findOne({ slug: teacherSlug }).select("name");
      if (found) teacher = found.name;
    }

    // upload images
    let images = [];
    if (req.files?.length) {
      const uploadResults = await uploadMultipleToCloudinary(
        req.files,
        "weekly-exams",
      );

      images = uploadResults.map((r) => ({
        imageUrl: r.secure_url,
        publicId: r.public_id,
      }));
    }

    const slug = buildSlug(ExamNumber, cls, subject, teacherSlug ?? "unknown");

    const exam = await WeeklyExam.create({
      subject,
      teacher,
      teacherSlug,
      class: cls,
      mark: Number(mark),
      ExamNumber,
      topics,
      images,
      slug,
    });

    return res.status(201).json(exam);
  } catch (err) {
    console.error("createWeeklyExam error:", err);
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ── PUT /api/weekly-exams/:id ─────────────────────────────
export const updateWeeklyExam = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subject,
      teacher,
      teacherSlug: rawSlug,
      class: cls,
      mark,
      ExamNumber,
      topics,
    } = req.body;

    const teacherSlug = await resolveTeacherSlug(rawSlug, teacher);

    const update = {
      ...(subject && { subject }),
      ...(teacher && { teacher }),
      ...(teacherSlug !== undefined && { teacherSlug }),
      ...(cls && { class: cls }),
      ...(mark && { mark: Number(mark) }),
      ...(ExamNumber && { ExamNumber }),
      ...(topics && { topics }),
    };

    if (req.files?.length) {
      const uploadResults = await uploadMultipleToCloudinary(
        req.files,
        "weekly-exams",
      );
      // updateWeeklyExam তেও একই
      update.images = uploadResults.map((r) => ({
        imageUrl: r.secure_url,
        publicId: r.public_id,
      }));
    }

    const exam = await WeeklyExam.findByIdAndUpdate(id, update, { new: true });
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    return res.status(200).json(exam);
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ── DELETE /api/weekly-exams/:id ──────────────────────────
export const deleteWeeklyExam = async (req, res) => {
  try {
    const exam = await WeeklyExam.findByIdAndDelete(req.params.id);
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    return res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};
