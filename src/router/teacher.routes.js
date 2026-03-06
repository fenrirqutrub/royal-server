// src/router/teacher.routes.js
import express from "express";
import {
  getTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  loginTeacher,
  getProfile,
  updateProfile,
  updateAvatar,
} from "../controllers/teacher.controller.js";
import {
  uploadSingleImage,
  handleUploadError,
} from "../middleware/upload.middleware.js";

const router = express.Router();

router.post("/login", loginTeacher); // POST   /api/teachers/login
router.get("/", getTeachers); // GET    /api/teachers
router.post("/", createTeacher); // POST   /api/teachers
router.patch("/:id", updateTeacher); // PATCH  /api/teachers/:id
router.delete("/:id", deleteTeacher); // DELETE /api/teachers/:id

// ── profile routes (slug-based) ───────────────────────────────────────────────
router.get("/:slug/profile", getProfile); // GET    /api/teachers/T2601/profile
router.patch("/:slug/profile", updateProfile); // PATCH  /api/teachers/T2601/profile
router.post(
  // POST   /api/teachers/T2601/avatar
  "/:slug/avatar",
  uploadSingleImage,
  handleUploadError,
  updateAvatar,
);

export default router;
