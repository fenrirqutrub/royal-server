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
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../config/cloudinary.js";
import Routine from "../models/routine.model.js";

const execFileAsync = promisify(execFile);

// PDF buffer → [ { buffer, pageNumber } ]
const pdfToPngBuffers = async (pdfBuffer) => {
  const tempDir = mkdtempSync(join(tmpdir(), "routine-"));
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

// retry wrapper — 3 বার try করবে
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
      // exponential backoff: 2s, 4s, 8s
      await new Promise((res) => setTimeout(res, attempt * 2000));
    }
  }
};

// ─── POST /api/routines ───────────────────────────────────────────────────────
export const createRoutine = async (req, res) => {
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
    const pngBuffers = await pdfToPngBuffers(req.file.buffer);
    console.log(`✅ PDF converted: ${pngBuffers.length} pages`);

    // Sequential upload — একটার পর একটা, retry সহ
    console.log("☁️ Uploading to Cloudinary (sequential)...");
    const uploadedPages = [];

    for (const { buffer, pageNumber } of pngBuffers) {
      const result = await uploadWithRetry(buffer, "routines", pageNumber);
      uploadedPages.push({
        pageNumber,
        url: result.secure_url,
        publicId: result.public_id,
      });
    }

    console.log(`✅ All ${uploadedPages.length} pages uploaded`);

    const routine = await Routine.create({
      pages: uploadedPages,
      totalPages: uploadedPages.length,
    });

    return res.status(201).json({
      success: true,
      message: "Routine created successfully",
      data: routine,
    });
  } catch (error) {
    console.error("❌ createRoutine error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to create routine",
      error: error.message,
    });
  }
};

// ─── GET /api/routines ────────────────────────────────────────────────────────
export const getAllRoutines = async (req, res) => {
  try {
    const routines = await Routine.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: routines });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/routines/active ─────────────────────────────────────────────────
export const getActiveRoutine = async (req, res) => {
  try {
    const routine = await Routine.findOne({ isActive: true }).sort({
      createdAt: -1,
    });
    if (!routine) {
      return res
        .status(404)
        .json({ success: false, message: "No active routine found" });
    }
    return res.status(200).json({ success: true, data: routine });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE /api/routines/:id ─────────────────────────────────────────────────
export const deleteRoutine = async (req, res) => {
  try {
    const routine = await Routine.findById(req.params.id);
    if (!routine) {
      return res
        .status(404)
        .json({ success: false, message: "Routine not found" });
    }

    for (const page of routine.pages) {
      await deleteFromCloudinary(page.publicId);
    }

    await routine.deleteOne();
    return res
      .status(200)
      .json({ success: true, message: "Routine deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PATCH /api/routines/:id/toggle ──────────────────────────────────────────
export const toggleRoutineStatus = async (req, res) => {
  try {
    const routine = await Routine.findById(req.params.id);
    if (!routine) {
      return res
        .status(404)
        .json({ success: false, message: "Routine not found" });
    }
    routine.isActive = !routine.isActive;
    await routine.save();
    return res.status(200).json({ success: true, data: routine });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
