//src/models/comment.model.js

import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    article: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Article",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 1000,
    },
    author: {
      type: String,
      default: "Anonymous",
    },
  },
  { timestamps: true },
);

export const Comment = mongoose.model("Comment", commentSchema);
