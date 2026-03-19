// src/router/user.routes.js
import express from "express";
import {
  login,
  logout,
  me,
  signup,
  completeOnboarding,
  checkStaffPhone,
} from "../controllers/auth.controller.js";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getProfile,
  updateProfile,
  updateAvatar,
} from "../controllers/user.controller.js";
import {
  uploadAvatar,
  uploadSingleImage,
  handleUploadError,
} from "../middleware/upload.middleware.js";

const router = express.Router();

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post("/auth/login", login);
router.post("/auth/logout", logout);
router.get("/auth/me", me);
router.post("/auth/check-staff-phone", checkStaffPhone); // ← NEW
router.post("/auth/signup", uploadAvatar, handleUploadError, signup);
router.post(
  "/auth/onboarding",
  uploadAvatar,
  handleUploadError,
  completeOnboarding,
);

// ── User CRUD (admin panel) ───────────────────────────────────────────────────
router.get("/users", getUsers);
router.post("/users", createUser);
router.patch("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// ── Profile (slug-based) ──────────────────────────────────────────────────────
router.get("/users/:slug/profile", getProfile);
router.patch("/users/:slug/profile", updateProfile);
router.post(
  "/users/:slug/avatar",
  uploadSingleImage,
  handleUploadError,
  updateAvatar,
);

export default router;
