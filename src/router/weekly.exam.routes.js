// routes/weekly.exam.routes.js

import express from "express";
import {
  getAllWeeklyExams,
  getWeeklyExamBySlug,
  createWeeklyExam,
  updateWeeklyExam,
  deleteWeeklyExam,
  recordView,
} from "../controllers/weekly.exam.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.route("/").get(getAllWeeklyExams).post(authenticate, createWeeklyExam);

// ✅ record-view আগে রাখুন :id route এর conflict এড়াতে
router.patch("/:id/record-view", authenticate, recordView);

router.get("/by-slug/:slug", getWeeklyExamBySlug);

router
  .route("/:id")
  .put(authenticate, updateWeeklyExam)
  .delete(authenticate, deleteWeeklyExam);

export default router;
