// src/router/photography.routes.js
import express from "express";
import {
  uploadPhotos,
  getPhotos,
  getPhotosAdmin,
  getPhoto,
  updatePhoto,
  deletePhoto,
  deleteBatchPhotos,
  incrementView,
} from "../controllers/photography.controller.js";
import {
  uploadMultiple,
  handleUploadError,
} from "../middleware/upload.middleware.js";
import { savePhotoUrls } from "../utils/save-urls.js";

const router = express.Router();

router.post("/save-urls", savePhotoUrls);

// Public routes
router.get("/", getPhotos);
router.get("/admin", getPhotosAdmin);

// Upload route (legacy - multer wala, optional rakhte paro)
router.post("/", uploadMultiple, handleUploadError, uploadPhotos);

// Batch delete (MUST be before /:id)
router.post("/batch/delete", deleteBatchPhotos);

// Single photo routes
router.get("/:id", getPhoto);
router.post("/:id/view", incrementView);
router.patch("/:id", updatePhoto);
router.delete("/:id", deletePhoto);

export default router;
