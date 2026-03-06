// src/router/teacher.profile.routes.js
import express from "express";
import multer from "multer";
import {
  getProfile,
  updateProfile,
  uploadAvatar,
} from "../controllers/teacher.profile.controller.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

router.get("/profile", getProfile); // ✅ এখানে
router.post("/upload-avatar", upload.single("file"), uploadAvatar);
router.patch("/update-profile", updateProfile);

export default router;
