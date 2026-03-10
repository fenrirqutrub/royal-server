// src/models/notice.model.js
import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema(
  {
    noticeSlug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    notice: {
      type: String,
      required: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

noticeSchema.index({ expiresAt: 1 });

const Notice = mongoose.model("Notice", noticeSchema);
export default Notice;
