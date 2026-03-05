//src/models/quotes.model.js

import mongoose from "mongoose";

const quoteSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, "Quote content is required"],
      trim: true,
      minlength: [5, "Quote is too short"],
      maxlength: [600, "Quote is too long (max 600 characters)"],
    },

    uniqueId: {
      type: String,
      unique: true,
      index: true,
    },

    author: {
      type: String,
      trim: true,
      default: "Anonymous",
      maxlength: 100,
    },

    isVisible: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

const Quote = mongoose.model("Quote", quoteSchema);

export default Quote;
