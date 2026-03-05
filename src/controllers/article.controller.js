// src/controllers/article.controller.js
import mongoose from "mongoose";
import slugify from "slugify";
import { Article } from "../models/article.model.js";
import { Category } from "../models/category.model.js";
import { Comment } from "../models/comment.model.js";

const findArticleByIdentifier = async (identifier, selectFields = "") => {
  let article = null;

  // 1. Try _id
  if (mongoose.isValidObjectId(identifier)) {
    article = await Article.findById(identifier).select(
      selectFields || undefined,
    );
  }

  // 2. Try uniqueId (e.g. "technology-3")
  if (!article) {
    article = await Article.findOne({ uniqueId: identifier }).select(
      selectFields || undefined,
    );
  }

  // 3. Try slug (e.g. "kire-kire") ← was missing before
  if (!article) {
    article = await Article.findOne({ slug: identifier }).select(
      selectFields || undefined,
    );
  }

  return article;
};

/**
 * Helper: generate unique ID based on category slug
 */
const generateUniqueId = async (categoryId) => {
  try {
    const category = await Category.findById(categoryId);
    if (!category) throw new Error("Category not found");

    const categorySlug = category.slug;

    const latestArticle = await Article.findOne({
      uniqueId: new RegExp(`^${categorySlug}-\\d+$`),
    })
      .sort({ uniqueId: -1 })
      .select("uniqueId")
      .lean();

    if (!latestArticle) return `${categorySlug}-1`;

    const match = latestArticle.uniqueId.match(/-(\d+)$/);
    const lastNumber = match ? parseInt(match[1], 10) : 0;

    return `${categorySlug}-${lastNumber + 1}`;
  } catch (error) {
    console.error("Error generating unique ID:", error);
    throw error;
  }
};

/**
 * POST /api/articles
 */

// src/controllers/article.controller.js  — createArticle only (rest unchanged)

export const createArticle = async (req, res) => {
  try {
    const { title, description, categoryId, author } = req.body; // ← add author

    if (
      !title?.trim() ||
      !description?.trim() ||
      !categoryId ||
      !req.cloudinaryResult
    ) {
      return res.status(400).json({
        success: false,
        message: "Title, description, categoryId, and image are required",
      });
    }

    if (!mongoose.isValidObjectId(categoryId))
      return res
        .status(400)
        .json({ success: false, message: "Invalid category ID" });

    if (title.trim().length < 5)
      return res
        .status(400)
        .json({ success: false, message: "Title min 5 characters" });

    if (description.trim().length < 20)
      return res
        .status(400)
        .json({ success: false, message: "Description min 20 characters" });

    const uniqueId = await generateUniqueId(categoryId);
    const slugBase = slugify(title.trim(), { lower: true, strict: true });
    const slug = slugBase || uniqueId;

    const article = await Article.create({
      title: title.trim(),
      description: description.trim(),
      slug,
      uniqueId,
      author: author?.trim() || "", // ← save author
      category: categoryId,
      imgUrl: req.cloudinaryResult.url,
    });

    await article.populate("category", "name slug");

    res
      .status(201)
      .json({ success: true, message: "Article created", data: article });
  } catch (err) {
    console.error("CREATE ARTICLE ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create article",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

/**
 * POST /api/articles/:identifier/view
 * ✅ Now supports _id, uniqueId, AND slug
 */
export const incrementView = async (req, res) => {
  const { identifier } = req.params;

  try {
    const article = await findArticleByIdentifier(identifier);

    if (!article) {
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });
    }

    article.views = (article.views || 0) + 1;
    await article.save();

    return res.json({
      success: true,
      data: { views: article.views },
      message: "View count updated",
    });
  } catch (err) {
    console.error("INCREMENT VIEW ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "View update failed",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

/**
 * GET /api/articles
 *
 * Query params:
 *   page, limit, search (title), category (ObjectId), categorySlug
 */
export const getArticles = async (req, res) => {
  try {
    const { categorySlug, category, search, limit, page = 1 } = req.query;

    const filter = {};

    if (category) {
      if (!mongoose.isValidObjectId(category))
        return res
          .status(400)
          .json({ success: false, message: "Invalid category ID" });
      filter.category = new mongoose.Types.ObjectId(category);
    } else if (categorySlug) {
      const found = await Category.findOne({ slug: categorySlug }).lean();
      if (!found)
        return res.status(404).json({
          success: false,
          message: `Category "${categorySlug}" not found`,
        });
      filter.category = found._id;
    }

    if (search && search.trim()) {
      filter.title = { $regex: search.trim(), $options: "i" };
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 0;
    const parsedPage = parseInt(page, 10);
    const skip = parsedLimit > 0 ? (parsedPage - 1) * parsedLimit : 0;

    const pipeline = [
      { $match: filter },
      { $sort: { createdAt: -1 } },
      ...(skip > 0 ? [{ $skip: skip }] : []),
      ...(parsedLimit > 0 ? [{ $limit: parsedLimit }] : []),
      {
        $lookup: {
          from: "comments",
          localField: "_id",
          foreignField: "article",
          as: "commentsList",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryData",
        },
      },
      {
        $addFields: {
          comments: { $size: "$commentsList" },
          category: { $arrayElemAt: ["$categoryData", 0] },
        },
      },
      {
        $project: { commentsList: 0, categoryData: 0, "category.__v": 0 },
      },
    ];

    const articles = await Article.aggregate(pipeline);
    const total = await Article.countDocuments(filter);

    return res.json({
      success: true,
      data: articles,
      count: articles.length,
      total,
      currentPage: parsedPage,
      totalPages: parsedLimit > 0 ? Math.ceil(total / parsedLimit) : 1,
    });
  } catch (err) {
    console.error("GET ARTICLES ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

/**
 * GET /api/articles/:identifier
 * ✅ Now supports _id, uniqueId, AND slug via $or in aggregation
 */
export const getArticleById = async (req, res) => {
  try {
    const { identifier } = req.params;

    let matchCondition;

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      matchCondition = { _id: new mongoose.Types.ObjectId(identifier) };
    } else {
      // Match uniqueId OR slug
      matchCondition = {
        $or: [{ uniqueId: identifier }, { slug: identifier }],
      };
    }

    const article = await Article.aggregate([
      { $match: matchCondition },
      {
        $lookup: {
          from: "comments",
          localField: "_id",
          foreignField: "article",
          as: "commentsList",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryData",
        },
      },
      {
        $addFields: {
          comments: { $size: "$commentsList" },
          category: { $ifNull: [{ $arrayElemAt: ["$categoryData", 0] }, null] },
        },
      },
      {
        $project: {
          commentsList: 0,
          categoryData: 0,
          __v: 0,
          "category.__v": 0,
        },
      },
    ]);

    if (!article || article.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });

    res.json({ success: true, data: article[0] });
  } catch (error) {
    console.error("GET ARTICLE BY ID ERROR:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * DELETE /api/articles/:identifier
 * ✅ Now supports _id, uniqueId, AND slug
 */
export const deleteArticle = async (req, res) => {
  try {
    const { identifier } = req.params;

    const article = await findArticleByIdentifier(identifier);

    if (!article)
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });

    await Article.findByIdAndDelete(article._id);
    await Comment.deleteMany({ article: article._id });

    res.json({ success: true, message: "Article deleted", data: article });
  } catch (err) {
    console.error("DELETE ARTICLE ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /api/articles/:identifier/comments
 * ✅ Now supports _id, uniqueId, AND slug
 */
export const getComments = async (req, res) => {
  try {
    const { identifier } = req.params;

    const article = await findArticleByIdentifier(identifier, "_id");

    if (!article)
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });

    const comments = await Comment.find({ article: article._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: comments, count: comments.length });
  } catch (err) {
    console.error("GET COMMENTS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch comments",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

/**
 * POST /api/articles/:identifier/comments
 * ✅ Now supports _id, uniqueId, AND slug
 */
export const addComment = async (req, res) => {
  try {
    const { identifier } = req.params;
    const { text } = req.body;

    if (!text || !text.trim())
      return res
        .status(400)
        .json({ success: false, message: "Comment text is required" });

    if (text.trim().length > 1000)
      return res.status(400).json({
        success: false,
        message: "Comment must be less than 1000 characters",
      });

    const article = await findArticleByIdentifier(identifier, "_id");

    if (!article)
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });

    const comment = await Comment.create({
      article: article._id,
      text: text.trim(),
      author: "Anonymous",
    });

    const totalComments = await Comment.countDocuments({
      article: article._id,
    });

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: comment,
      totalComments,
    });
  } catch (err) {
    console.error("ADD COMMENT ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to add comment",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
