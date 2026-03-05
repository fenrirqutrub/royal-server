// src/models/article.model.js
import mongoose from "mongoose";
const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    uniqueId: { type: String, required: true, unique: true, index: true },
    imgUrl: { type: String },
    author: { type: String, trim: true, default: "" }, // ← NEW
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    views: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export const Article = mongoose.model("Article", articleSchema);
