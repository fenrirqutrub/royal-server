import { execFile } from "child_process";
import { promisify } from "util";
import {
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  mkdtempSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import sharp from "sharp";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../config/cloudinary.js";
import ExamMarks from "../models/exam.marks.model.js";

const execFileAsync = promisify(execFile);

// ── Blank page detection ──────────────────────────────────────────────────────
// grayscale করে সব pixel এর mean brightness বের করে
// mean > 250 মানে প্রায় সাদা → blank page → skip
const isBlankPage = async (buffer, threshold = 250) => {
  const { data, info } = await sharp(buffer)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const total = data.reduce((sum, pixel) => sum + pixel, 0);
  const mean = total / (info.width * info.height);
  console.log(
    `   brightness mean: ${mean.toFixed(2)} (threshold: ${threshold})`,
  );
  return mean > threshold;
};

// ── PDF buffer → [ { buffer, pageNumber } ] ───────────────────────────────────
const pdfToPngBuffers = async (pdfBuffer) => {
  const tempDir = mkdtempSync(join(tmpdir(), "exammarks-"));
  const pdfPath = join(tempDir, "input.pdf");

  try {
    writeFileSync(pdfPath, pdfBuffer);

    await execFileAsync("pdftoppm", [
      "-r",
      "150",
      "-png",
      pdfPath,
      join(tempDir, "page"),
    ]);

    const files = readdirSync(tempDir)
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort();

    if (!files.length) throw new Error("No pages extracted from PDF");

    return files.map((filename, index) => ({
      buffer: readFileSync(join(tempDir, filename)),
      pageNumber: index + 1,
    }));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
};

// ── retry wrapper ─────────────────────────────────────────────────────────────
const uploadWithRetry = async (buffer, folder, pageNumber, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`   uploading page ${pageNumber} (attempt ${attempt})...`);
      const result = await uploadToCloudinary(buffer, folder);
      console.log(`   ✅ page ${pageNumber} done`);
      return result;
    } catch (err) {
      console.warn(
        `   ⚠️ page ${pageNumber} attempt ${attempt} failed: ${err.message}`,
      );
      if (attempt === retries) throw err;
      await new Promise((res) => setTimeout(res, attempt * 2000));
    }
  }
};

// ─── POST /api/exam-marks ─────────────────────────────────────────────────────
export const createExamMarks = async (req, res) => {
  try {
    console.log(
      "📥 req.file:",
      req.file
        ? `${req.file.originalname} (${req.file.size} bytes)`
        : "MISSING",
    );

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "PDF file is required" });
    }

    console.log("🔄 Starting PDF conversion...");
    const allPages = await pdfToPngBuffers(req.file.buffer);
    console.log(`✅ PDF converted: ${allPages.length} total pages`);

    // ── blank page filter ─────────────────────────────────────────────────
    console.log("🔍 Checking for blank pages...");
    const nonBlankPages = [];
    for (const page of allPages) {
      const blank = await isBlankPage(page.buffer);
      if (blank) {
        console.log(`   🚫 page ${page.pageNumber} is blank — skipped`);
      } else {
        nonBlankPages.push(page);
      }
    }
    console.log(
      `✅ ${nonBlankPages.length} non-blank pages (${allPages.length - nonBlankPages.length} skipped)`,
    );

    if (nonBlankPages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "PDF contains only blank pages",
      });
    }

    // ── upload non-blank pages (re-number sequentially) ───────────────────
    console.log("☁️ Uploading to Cloudinary (sequential)...");
    const uploadedPages = [];

    for (let i = 0; i < nonBlankPages.length; i++) {
      const { buffer } = nonBlankPages[i];
      const pageNumber = i + 1; // sequential after blank removal
      const result = await uploadWithRetry(buffer, "exam-marks", pageNumber);
      uploadedPages.push({
        pageNumber,
        url: result.secure_url,
        publicId: result.public_id,
      });
    }

    console.log(`✅ All ${uploadedPages.length} pages uploaded`);

    const examMarks = await ExamMarks.create({
      pages: uploadedPages,
      totalPages: uploadedPages.length,
    });

    return res.status(201).json({
      success: true,
      message: "Exam marks created successfully",
      data: examMarks,
    });
  } catch (error) {
    console.error("❌ createExamMarks error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to create exam marks",
      error: error.message,
    });
  }
};

// ─── GET /api/exam-marks ──────────────────────────────────────────────────────
export const getAllExamMarks = async (req, res) => {
  try {
    const examMarks = await ExamMarks.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: examMarks });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/exam-marks/active ───────────────────────────────────────────────
export const getActiveExamMarks = async (req, res) => {
  try {
    const examMarks = await ExamMarks.findOne({ isActive: true }).sort({
      createdAt: -1,
    });
    if (!examMarks) {
      return res
        .status(404)
        .json({ success: false, message: "No active exam marks found" });
    }
    return res.status(200).json({ success: true, data: examMarks });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE /api/exam-marks/:id ───────────────────────────────────────────────
export const deleteExamMarks = async (req, res) => {
  try {
    const examMarks = await ExamMarks.findById(req.params.id);
    if (!examMarks) {
      return res
        .status(404)
        .json({ success: false, message: "Exam marks not found" });
    }

    for (const page of examMarks.pages) {
      await deleteFromCloudinary(page.publicId);
    }

    await examMarks.deleteOne();
    return res
      .status(200)
      .json({ success: true, message: "Exam marks deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PATCH /api/exam-marks/:id/toggle ────────────────────────────────────────
export const toggleExamMarksStatus = async (req, res) => {
  try {
    const examMarks = await ExamMarks.findById(req.params.id);
    if (!examMarks) {
      return res
        .status(404)
        .json({ success: false, message: "Exam marks not found" });
    }
    examMarks.isActive = !examMarks.isActive;
    await examMarks.save();
    return res.status(200).json({ success: true, data: examMarks });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
