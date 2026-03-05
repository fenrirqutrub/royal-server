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

const router = express.Router();

// Public routes
router.get("/", getPhotos);
router.get("/admin", getPhotosAdmin);
router.get("/:id", getPhoto);

// View increment route
router.post("/:id/view", incrementView);

// Upload route (with file handling)
router.post("/", uploadMultiple, handleUploadError, uploadPhotos);

// Update and delete routes
router.patch("/:id", updatePhoto);
router.delete("/:id", deletePhoto);
router.post("/batch/delete", deleteBatchPhotos);

export default router;
