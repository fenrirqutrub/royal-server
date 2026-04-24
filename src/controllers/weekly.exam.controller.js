// src/controllers/weekly.exam.controller.js
import WeeklyExam from "../models/weekly.exam.model.js";
import Teacher from "../models/user.model.js";
import { deleteFromCloudinary } from "../config/cloudinary.js";

// ── Helper: Bangla to ASCII digits ─────────────────────────────────────────
const toAsciiDigits = (str) => {
  if (!str) return null;
  return str
    .toString()
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
    .replace(/–|—/g, "-")
    .trim();
};

// ── Helper: resolve teacherSlug from name if not provided ────────────────────
const resolveTeacherSlug = async (rawSlug, teacherName) => {
  if (rawSlug) return rawSlug;
  if (!teacherName) return null;
  const found = await Teacher.findOne({
    name: { $regex: new RegExp(`^${teacherName.trim()}$`, "i") },
  }).select("slug");
  return found?.slug ?? null;
};

// ── Helper: build slug ────────────────────────────────────
const buildSlug = (ExamNumber, cls, subject, teacherSlug) =>
  `${ExamNumber}-${cls}-${subject}-${teacherSlug ?? "unknown"}`
    .replace(/\s+/g, "-")
    .toLowerCase();

// ── GET /api/weekly-exams ─────────────────────────────────

export const getAllWeeklyExams = async (req, res) => {
  try {
    const exams = await WeeklyExam.find()
      .sort({ createdAt: -1 })
      .populate("viewedBy.userId", "name studentClass roll avatar");

    const safeExams = exams.map((exam) => {
      const obj = exam.toObject();
      obj.viewedBy = (obj.viewedBy || []).filter((v) => v.userId);
      return obj;
    });

    return res.status(200).json(safeExams);
  } catch (err) {
    console.error("getAllWeeklyExams error:", err);
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
      numberType = "chapterNumber",
      pageNumber,
      chapterNumber,
      topics,
      question,
      images: imageUrls,
    } = req.body;

    // ── Validate required fields ───────────────────────────────
    if (!subject?.trim()) {
      return res.status(400).json({ message: "বিষয় আবশ্যিক" });
    }
    if (!teacher?.trim()) {
      return res.status(400).json({ message: "শিক্ষকের নাম আবশ্যিক" });
    }
    if (!cls?.trim()) {
      return res.status(400).json({ message: "শ্রেণি আবশ্যিক" });
    }
    if (!mark) {
      return res.status(400).json({ message: "পূর্ণমান আবশ্যিক" });
    }
    if (!ExamNumber?.trim()) {
      return res.status(400).json({ message: "পরীক্ষা নম্বর আবশ্যিক" });
    }
    if (!topics?.trim()) {
      return res.status(400).json({ message: "বিষয়বস্তু আবশ্যিক" });
    }

    const teacherSlug = await resolveTeacherSlug(rawSlug, teacher);

    let finalPageNumber = null;
    let finalChapterNumber = null;

    const numberValue =
      numberType === "pageNumber" ? pageNumber : chapterNumber;

    if (!numberValue?.toString().trim()) {
      return res.status(400).json({
        message:
          numberType === "pageNumber"
            ? "পৃষ্ঠা নম্বর আবশ্যিক"
            : "অধ্যায় নম্বর আবশ্যিক",
      });
    }

    const processedNumber = toAsciiDigits(numberValue);

    if (numberType === "pageNumber") {
      finalPageNumber = processedNumber;
    } else {
      finalChapterNumber = processedNumber;
    }

    const images = Array.isArray(imageUrls)
      ? imageUrls
          .filter((img) => img && img.imageUrl)
          .map((img) => ({
            imageUrl: img.imageUrl,
            publicId: img.publicId,
          }))
      : [];

    const slug = buildSlug(
      toAsciiDigits(ExamNumber),
      cls,
      subject,
      teacherSlug,
    );

    const examData = {
      subject: subject.trim(),
      teacher: teacher.trim(),
      teacherSlug,
      class: cls.trim(),
      mark: Number(mark),
      ExamNumber: toAsciiDigits(ExamNumber),
      numberType,
      pageNumber: finalPageNumber,
      chapterNumber: finalChapterNumber,
      topics: topics.trim(),
      question: question?.trim() || null,
      images,
      slug,
    };

    const exam = await WeeklyExam.create(examData);
    return res.status(201).json(exam);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: "এই পরীক্ষার তথ্য ইতোমধ্যে যোগ করা আছে",
      });
    }
    return res.status(500).json({ message: "পরীক্ষা তৈরি করতে সমস্যা হয়েছে" });
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
      numberType,
      pageNumber,
      chapterNumber,
      topics,
      question,
      images: newImages,
    } = req.body;

    const existingExam = await WeeklyExam.findById(id);
    if (!existingExam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const teacherSlug = await resolveTeacherSlug(rawSlug, teacher);

    const update = {};

    if (subject?.trim()) update.subject = subject.trim();
    if (teacher?.trim()) update.teacher = teacher.trim();
    if (teacherSlug) update.teacherSlug = teacherSlug;
    if (cls?.trim()) update.class = cls.trim();
    if (mark) update.mark = Number(mark);
    if (ExamNumber?.trim()) update.ExamNumber = toAsciiDigits(ExamNumber);
    if (topics?.trim()) update.topics = topics.trim();
    if (question !== undefined) update.question = question?.trim() || null;

    if (numberType) {
      update.numberType = numberType;

      const numberValue =
        numberType === "pageNumber" ? pageNumber : chapterNumber;

      if (numberValue?.toString().trim()) {
        const processedNumber = toAsciiDigits(numberValue);

        if (numberType === "pageNumber") {
          update.pageNumber = processedNumber;
          update.chapterNumber = null;
        } else {
          update.chapterNumber = processedNumber;
          update.pageNumber = null;
        }
      }
    }

    // ✅ Handle images (URLs from frontend)
    if (Array.isArray(newImages) && newImages.length > 0) {
      if (existingExam.images?.length) {
        await Promise.all(
          existingExam.images.map((img) =>
            img.publicId
              ? deleteFromCloudinary(img.publicId)
              : Promise.resolve(),
          ),
        );
      }
      update.images = newImages;
    }

    const exam = await WeeklyExam.findByIdAndUpdate(id, update, {
      new: true,
    });

    return res.status(200).json(exam);
  } catch (err) {
    console.error("updateWeeklyExam error:", err);
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ── DELETE /api/weekly-exams/:id ──────────────────────────
export const deleteWeeklyExam = async (req, res) => {
  try {
    const exam = await WeeklyExam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    // Delete images from Cloudinary
    if (exam.images?.length) {
      await Promise.all(
        exam.images.map((img) =>
          img.publicId ? deleteFromCloudinary(img.publicId) : Promise.resolve(),
        ),
      );
    }

    await WeeklyExam.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// src/controllers/weekly.exam.controller.js

export const recordView = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "অনুমতি নেই" });
    }

    const exam = await WeeklyExam.findByIdAndUpdate(
      id,
      {
        $push: { viewedBy: { userId, viewedAt: new Date() } },
        $inc: { viewCount: 1 },
      },
      { new: true },
    ).populate("viewedBy.userId", "name studentClass roll avatar");

    if (!exam) {
      return res.status(404).json({ message: "পরীক্ষা পাওয়া যায়নি" });
    }

    return res.status(200).json({
      success: true,
      viewCount: exam.viewCount,
      viewedBy: exam.viewedBy.filter((v) => v.userId),
    });
  } catch (err) {
    console.error("recordView error:", err);
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};
