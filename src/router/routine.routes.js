// src/router/routine.routes.js
import express from "express";
import multer from "multer";
import {
  createRoutine,
  getAllRoutines,
  getActiveRoutine,
  deleteRoutine,
  toggleRoutineStatus,
} from "../controllers/routine.controller.js";

const router = express.Router();

// PDF upload middleware — memory storage, 20MB limit
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

const handlePdfUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({
          success: false,
          message: "PDF too large. Maximum size is 20MB.",
        });
    }
    return res.status(400).json({ success: false, message: err.message });
  } else if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

// Routes
router.post("/", pdfUpload.single("pdf"), handlePdfUploadError, createRoutine);
router.get("/", getAllRoutines);
router.get("/active", getActiveRoutine);
router.delete("/:id", deleteRoutine);
router.patch("/:id/toggle", toggleRoutineStatus);

export default router;
