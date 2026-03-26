// src/routes/hero.routes.js
import express from "express";
import {
  createHero,
  getAllHeroes,
  getHeroById,
  getHeroByUniqueId,
  deleteHero,
  updateHero,
} from "../controllers/hero.controller.js";
import {
  uploadHeroImage,
  handleHeroUploadError,
  validateLandscapeImage,
} from "../middleware/upload.middleware.js";

const router = express.Router();

// IMPORTANT: validateLandscapeImage MUST be AFTER handleUploadError
router.post("/", uploadHeroImage, handleHeroUploadError, createHero);
router.put("/:id", uploadHeroImage, handleHeroUploadError, updateHero);

router.get("/", getAllHeroes);
router.get("/unique/:uniqueID", getHeroByUniqueId);
router.get("/:id", getHeroById);
router.delete("/:id", deleteHero);

export default router;
