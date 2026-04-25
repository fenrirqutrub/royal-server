// src/models/complain.model.js
// src/models/complain.model.js
import mongoose from "mongoose";

const complainSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
      minlength: 10,
      trim: true,
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved"],
      default: "pending",
    },
  },
  { timestamps: true },
);

const Complain = mongoose.model("Complain", complainSchema);
export default Complain;
