// src/controllers/category.controller.js
import slugify from "slugify";
import { Category } from "../models/category.model.js";
import mongoose from "mongoose";

/**
 * POST /api/categories
 */
export const createCategory = async (req, res) => {
  console.log("→ createCategory called");
  console.log("Body raw:", req.body);

  try {
    const { name } = req.body;
    console.log("BODY RECEIVED:", req.body);

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false, // ✅ Add this
        message: "Category name is required (min 2 chars)",
      });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const exists = await Category.findOne({
      $or: [{ name: name.trim() }, { slug }],
    });

    if (exists) {
      return res.status(409).json({
        success: false, // ✅ Add this
        message: "Category already exists",
      });
    }

    const category = await Category.create({
      name: name.trim(),
    });

    res.status(201).json({
      success: true, // ✅ Add this
      message: "Category created",
      data: category,
    });
  } catch (err) {
    console.error("CREATE CATEGORY ERROR:", err);
    res.status(500).json({
      success: false, // ✅ Add this
      message: "Failed to create category",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

/**
 * GET /api/categories
 */
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });

    console.log("Categories fetched:", categories.length); // ✅ Debug

    res.status(200).json({
      // ✅ Add status
      success: true, // ✅ Add this
      data: categories,
    });
  } catch (err) {
    console.error("GET CATEGORIES ERROR:", err); // ✅ Better error log
    res.status(500).json({
      success: false, // ✅ Add this
      message: "Failed to fetch categories",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

/**
 * DELETE /api/categories/:id
 */
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false, // ✅ Add this
        message: "Invalid category ID",
      });
    }

    const deleted = await Category.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false, // ✅ Add this
        message: "Category not found",
      });
    }

    res.status(200).json({
      success: true, // ✅ Add this
      message: "Category deleted",
      data: deleted,
    });
  } catch (err) {
    console.error("DELETE CATEGORY ERROR:", err);
    res.status(500).json({
      success: false, // ✅ Add this
      message: "Failed to delete category",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
