// src/controllers/weekly.exam.controller.js
import WeeklyExam from "../models/weekly.exam.model.js";
import Teacher from "../models/user.model.js";
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
    const exams = await WeeklyExam.find().sort({ createdAt: -1 });
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
      chapterNumber,
      topics,
    } = req.body;

    // Teacher resolve
    const teacherSlug = await resolveTeacherSlug(rawSlug, teacher);
    if (!teacher?.trim() && teacherSlug) {
      const found = await Teacher.findOne({ slug: teacherSlug }).select("name");
      if (found) teacher = found.name;
    }

    // ── chapterNumber handling (multiple ranges + comma support) ──
    let finalChapterNumber = null;

    if (chapterNumber?.toString().trim()) {
      let cleaned = chapterNumber.toString().trim();

      // বাংলা → ইংরেজি নাম্বার কনভার্ট (frontend থেকে না আসলে এখানে করব)
      cleaned = cleaned
        .replace(/০/g, "0")
        .replace(/১/g, "1")
        .replace(/২/g, "2")
        .replace(/৩/g, "3")
        .replace(/৪/g, "4")
        .replace(/৫/g, "5")
        .replace(/৬/g, "6")
        .replace(/৭/g, "7")
        .replace(/৮/g, "8")
        .replace(/৯/g, "9")
        .replace(/।/g, ".")
        .replace(/–|—/g, "-");

      // Validation
      if (!/^[0-9.\-–, ]+$/.test(cleaned)) {
        return res.status(400).json({
          message:
            "অধ্যায়/পৃষ্ঠা নম্বর সঠিক ফরম্যাটে দিন (যেমন: ২৫-৩০, ৬০-৬৭)",
        });
      }

      finalChapterNumber = cleaned;
    }

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
      chapterNumber: finalChapterNumber,
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
      chapterNumber,
      topics,
    } = req.body;

    const teacherSlug = await resolveTeacherSlug(rawSlug, teacher);

    let finalChapterNumber = null;
    if (chapterNumber?.toString().trim()) {
      const asciiChapter = toAsciiDigits
        ? toAsciiDigits(chapterNumber.toString().trim())
        : chapterNumber.toString().trim();

      finalChapterNumber = asciiChapter;
    }

    const update = {
      ...(subject && { subject }),
      ...(teacher && { teacher }),
      ...(teacherSlug !== undefined && { teacherSlug }),
      ...(cls && { class: cls }),
      ...(mark && { mark: Number(mark) }),
      ...(ExamNumber && { ExamNumber }),
      ...(finalChapterNumber !== undefined && {
        chapterNumber: finalChapterNumber,
      }),
      ...(topics && { topics }),
    };

    if (req.files?.length) {
      const uploadResults = await uploadMultipleToCloudinary(
        req.files,
        "weekly-exams",
      );
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
