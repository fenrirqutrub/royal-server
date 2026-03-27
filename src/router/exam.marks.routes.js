import express from "express";
import multer from "multer";
import {
  createExamMarks,
  getAllExamMarks,
  getActiveExamMarks,
  deleteExamMarks,
  toggleExamMarksStatus,
} from "../controllers/exam.marks.controller.js";

const router = express.Router();

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
      return res.status(400).json({
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

router.post(
  "/",
  pdfUpload.single("pdf"),
  handlePdfUploadError,
  createExamMarks,
);
router.get("/", getAllExamMarks);
router.get("/active", getActiveExamMarks);
router.delete("/:id", deleteExamMarks);
router.patch("/:id/toggle", toggleExamMarksStatus);

export default router;
