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

const router = express.Router();

router.post("/", createHero);
router.put("/:id", updateHero);

router.get("/", getAllHeroes);
router.get("/unique/:uniqueID", getHeroByUniqueId);
router.get("/:id", getHeroById);
router.delete("/:id", deleteHero);

export default router;
