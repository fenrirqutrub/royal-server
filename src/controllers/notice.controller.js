// src/controller/notice.controller.js
import Notice from "../models/notice.model.js";
import { generateNoticePdf } from "../utils/Generatenoticepdf.js";

// ── slug generator ────────────────────────────────────────────────────────────
const generateSlug = async (date = new Date()) => {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const prefix = `RABN-${yy}${mm}${dd}`;

  const regex = new RegExp(`^${prefix}-N\\d+$`);
  const existing = await Notice.find({ noticeSlug: regex }).select(
    "noticeSlug",
  );
  const seq = existing.length + 1;

  return `${prefix}-N${seq}`;
};

// ── POST /api/notices ─────────────────────────────────────────────────────────
export const createNotice = async (req, res) => {
  try {
    const { notice, durationDays } = req.body;

    if (!notice || !notice.trim()) {
      return res.status(400).json({ message: "Notice text is required." });
    }

    const days = parseInt(durationDays, 10);
    if (!days || days < 1 || days > 365) {
      return res
        .status(400)
        .json({ message: "Duration must be between 1 and 365 days." });
    }

    const noticeSlug = await generateSlug();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const newNotice = await Notice.create({
      noticeSlug,
      notice: notice.trim(),
      expiresAt,
    });

    res
      .status(201)
      .json({ message: "Notice created successfully.", data: newNotice });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Duplicate slug, please retry." });
    }
    console.error("createNotice error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

// ── GET /api/notices/active ───────────────────────────────────────────────────
export const getActiveNotice = async (req, res) => {
  try {
    const notice = await Notice.findOne({
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    res.status(200).json({ data: notice || null });
  } catch (err) {
    console.error("getActiveNotice error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

// ── GET /api/notices ──────────────────────────────────────────────────────────
export const getAllNotices = async (req, res) => {
  try {
    const notices = await Notice.find().sort({ createdAt: -1 });
    res.status(200).json({ data: notices });
  } catch (err) {
    console.error("getAllNotices error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

// ── GET /api/notices/:slug/pdf ────────────────────────────────────────────────
export const getNoticePdf = async (req, res) => {
  try {
    const notice = await Notice.findOne({ noticeSlug: req.params.slug });
    if (!notice) {
      return res.status(404).json({ message: "Notice not found." });
    }

    const pdfBuffer = await generateNoticePdf(notice.toObject());

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${notice.noticeSlug}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error("getNoticePdf error:", err);
    res.status(500).json({ message: "Failed to generate PDF." });
  }
};

// ── DELETE /api/notices/:slug ─────────────────────────────────────────────────
export const deleteNotice = async (req, res) => {
  try {
    const deleted = await Notice.findOneAndDelete({
      noticeSlug: req.params.slug,
    });
    if (!deleted) return res.status(404).json({ message: "Notice not found." });
    res.status(200).json({ message: "Notice deleted.", data: deleted });
  } catch (err) {
    console.error("deleteNotice error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};
