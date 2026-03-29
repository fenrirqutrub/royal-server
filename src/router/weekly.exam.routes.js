import express from "express";
import {
  getAllWeeklyExams,
  getWeeklyExamBySlug,
  createWeeklyExam,
  updateWeeklyExam,
  deleteWeeklyExam,
} from "../controllers/weekly.exam.controller.js";
import {
  uploadMultiple,
  handleUploadError,
} from "../middleware/upload.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js"; // ✅ নতুন
import { authenticateOptional } from "../middleware/auth.middleware.js";

const router = express.Router();

router
  .route("/")
  .get(authenticateOptional, getAllWeeklyExams)
  .post(uploadMultiple, handleUploadError, (req, res, next) => {
    createWeeklyExam(req, res, next).catch(next);
  });

router.get("/:slug", getWeeklyExamBySlug);
router
  .route("/:id")
  .put(uploadMultiple, handleUploadError, (req, res, next) => {
    updateWeeklyExam(req, res, next).catch(next);
  })
  .delete(deleteWeeklyExam);

export default router;
