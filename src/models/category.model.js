// src/models/category.model.js
import mongoose from "mongoose";
import slugify from "slugify";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
      unique: true,
    },
    slug: {
      type: String,
      unique: true, // ✅ Uncomment this
      index: true, // ✅ Uncomment this
    },
  },
  { timestamps: true },
);

// ✅ Pre-save hook
categorySchema.pre("save", async function () {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
    });
  }
});

export const Category = mongoose.model("Category", categorySchema);
