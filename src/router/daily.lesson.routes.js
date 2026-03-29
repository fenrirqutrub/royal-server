import express from "express";
import multer from "multer";
import {
  createDailyLesson,
  getAllDailyLessons,
  getDailyLessonById,
  updateDailyLesson,
  deleteDailyLesson,
} from "../controllers/daily.lesson.controller.js";
import { authenticateOptional } from "../middleware/auth.middleware.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
});

router.post("/", upload.array("images", 10), createDailyLesson);

router.get("/", authenticateOptional, getAllDailyLessons);

router.get("/:id", getDailyLessonById);
router.patch("/:id", updateDailyLesson);
router.delete("/:id", deleteDailyLesson);

export default router;
