// src/models/photography.model.js
import mongoose from "mongoose";

const photographySchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    format: {
      type: String,
    },
    size: {
      type: Number, // in bytes
    },
    views: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Index for faster queries
photographySchema.index({ createdAt: -1 });
photographySchema.index({ isActive: 1 });

export const Photography = mongoose.model("Photography", photographySchema);
