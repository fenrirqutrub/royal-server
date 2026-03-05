// src/routes/quotes.routes.js

import express from "express";
import {
  createQuote,
  getAllQuotes,
  getRandomQuote,
  getQuoteById,
  deleteQuote,
} from "../controllers/quotes.controller.js";

const router = express.Router();

// Create a new quote
router.post("/", createQuote);

// Get all quotes (with pagination)
router.get("/", getAllQuotes);

// Get random quote (must be before /:id to avoid conflict)
router.get("/random", getRandomQuote);

// Get single quote by ID
router.get("/:id", getQuoteById);

// Delete quote (soft delete)
router.delete("/:id", deleteQuote);

export default router;
