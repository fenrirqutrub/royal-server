// /src/router/user.routes.js

import express from "express";
import {
  login,
  logout,
  me,
  signup,
  completeOnboarding,
  checkStaffPhone,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import {
  getUsers,
  getPublicStaff,
  createUser,
  updateUser,
  deleteUser,
  getProfile,
  updateProfile,
  updateAvatar,
} from "../controllers/user.controller.js";
import {
  heartbeat,
  getSessions,
  getSessionSummary,
} from "../controllers/session.controller.js"; // ✅ নতুন
import {
  authenticate,
  authenticateOptional,
} from "../middleware/auth.middleware.js";
import {
  uploadAvatar,
  uploadSingleImage,
  handleUploadError,
} from "../middleware/upload.middleware.js";

const router = express.Router();

// ── Auth (public) ──
router.post("/auth/login", login);
router.post("/auth/check-staff-phone", checkStaffPhone);
router.post("/auth/signup", uploadAvatar, handleUploadError, signup);
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/reset-password", resetPassword);

// ── Auth (protected) ──
router.get("/auth/me", authenticate, me);
router.post("/auth/logout", authenticate, logout); // ✅ authenticate দিলাম session close এর জন্য
router.post(
  "/auth/onboarding",
  authenticate,
  uploadAvatar,
  handleUploadError,
  completeOnboarding,
);

// ── Session tracking ──
router.post("/sessions/heartbeat", authenticate, heartbeat); // ✅ নতুন
router.get("/sessions", authenticate, getSessions); // ✅ নতুন
router.get("/sessions/summary", authenticate, getSessionSummary); // ✅ নতুন

// ── User CRUD ──
router.get("/users/public", getPublicStaff);
router.get("/users", authenticate, getUsers);
router.post("/users", authenticate, createUser);
router.patch("/users/:id", authenticate, updateUser);
router.delete("/users/:id", authenticate, deleteUser);

// ── Profile ──
router.get("/users/:slug/profile", getProfile);
router.patch("/users/:slug/profile", authenticate, updateProfile);
router.post(
  "/users/:slug/avatar",
  authenticate,
  uploadSingleImage,
  handleUploadError,
  updateAvatar,
);

export default router;
