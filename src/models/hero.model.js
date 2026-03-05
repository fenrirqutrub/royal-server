// src/models/hero.model.js
import mongoose from "mongoose";

const heroSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    uniqueID: {
      type: String,
      required: [true, "Unique ID is required"],
      unique: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^hero-\d+$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid format! Use hero-1, hero-2, etc.`,
      },
    },
    imageUrl: {
      type: String,
      required: [true, "Image URL is required"],
    },
    imagePublicId: {
      type: String,
      required: [true, "Image public ID is required"],
    },
  },
  {
    timestamps: true,
  },
);

// Create index for uniqueID
heroSchema.index({ uniqueID: 1 });

const Hero = mongoose.model("Hero", heroSchema);

export default Hero;
