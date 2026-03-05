// src/routes/router.js

import express from "express";
import {
  createCategory,
  deleteCategory,
  getCategories,
} from "../controllers/category.controller.js";

const router = express.Router();

// category
router.get("/", getCategories);
router.post("/", createCategory);
router.delete("/:id", deleteCategory);

export default router;
