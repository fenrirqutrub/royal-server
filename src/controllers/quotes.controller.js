// src/controllers/quotes.controller.js

import Quote from "../models/quotes.model.js";

/**
 * POST /api/quotes
 */
export const createQuote = async (req, res) => {
  try {
    const { content, author } = req.body;

    // Validation
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Quote content is required",
      });
    }

    if (content.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Quote must be at least 10 characters",
      });
    }

    if (content.trim().length > 600) {
      return res.status(400).json({
        success: false,
        message: "Quote must not exceed 600 characters",
      });
    }

    // Find last quote based on numeric part
    const lastQuote = await Quote.findOne({})
      .sort({ createdAt: -1 })
      .select("uniqueId")
      .lean();

    let nextNumber = 1;

    if (lastQuote?.uniqueId) {
      const match = lastQuote.uniqueId.match(/quote-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    const uniqueId = `quote-${nextNumber}`;

    const quote = await Quote.create({
      content: content.trim(),
      author: author?.trim() || "Anonymous",
      uniqueId,
    });

    return res.status(201).json({
      success: true,
      message: "Quote added successfully",
      data: quote,
    });
  } catch (error) {
    console.error("CREATE QUOTE ERROR:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate quote ID — try again",
      });
    }

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while adding quote",
    });
  }
};

/**
 * GET /api/quotes
 */
export const getAllQuotes = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const quotes = await Quote.find({ isVisible: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Quote.countDocuments({ isVisible: true });

    return res.json({
      success: true,
      count: quotes.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: quotes,
    });
  } catch (error) {
    console.error("GET QUOTES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching quotes",
    });
  }
};

/**
 * GET /api/quotes/random
 * Uses MongoDB aggregation (better than skip)
 */
export const getRandomQuote = async (req, res) => {
  try {
    const quote = await Quote.aggregate([
      { $match: { isVisible: true } },
      { $sample: { size: 1 } },
    ]);

    if (!quote || quote.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No quotes available",
      });
    }

    return res.json({
      success: true,
      data: quote[0],
    });
  } catch (error) {
    console.error("RANDOM QUOTE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching random quote",
    });
  }
};

/**
 * GET /api/quotes/:id
 * Get single quote by uniqueId or MongoDB _id
 */
export const getQuoteById = async (req, res) => {
  try {
    const { id } = req.params;

    // Try to find by uniqueId first, then by _id
    let quote = await Quote.findOne({ uniqueId: id, isVisible: true }).lean();

    if (!quote) {
      // Check if it's a valid MongoDB ObjectId
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        quote = await Quote.findOne({ _id: id, isVisible: true }).lean();
      }
    }

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: "Quote not found",
      });
    }

    return res.json({
      success: true,
      data: quote,
    });
  } catch (error) {
    console.error("GET QUOTE BY ID ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching quote",
    });
  }
};

/**
 * DELETE /api/quotes/:id
 * Soft delete by setting isVisible to false
 */
export const deleteQuote = async (req, res) => {
  try {
    const { id } = req.params;

    let quote = await Quote.findOne({ uniqueId: id });

    if (!quote && id.match(/^[0-9a-fA-F]{24}$/)) {
      quote = await Quote.findById(id);
    }

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: "Quote not found",
      });
    }

    quote.isVisible = false;
    await quote.save();

    return res.json({
      success: true,
      message: "Quote deleted successfully",
    });
  } catch (error) {
    console.error("DELETE QUOTE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting quote",
    });
  }
};
