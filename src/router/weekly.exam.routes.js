import express from "express";
import {
  getAllWeeklyExams,
  getWeeklyExamBySlug,
  createWeeklyExam,
  updateWeeklyExam,
  deleteWeeklyExam,
} from "../controllers/weekly.exam.controller.js";

const router = express.Router();

router.route("/").get(getAllWeeklyExams).post(createWeeklyExam);
router.get("/:slug", getWeeklyExamBySlug);
router.route("/:id").put(updateWeeklyExam).delete(deleteWeeklyExam);

export default router;
