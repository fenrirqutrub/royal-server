// src/models/routine.model.js
import mongoose from "mongoose";

const routineSchema = new mongoose.Schema(
  {
    pages: [
      {
        pageNumber: { type: Number, required: true },
        url: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
    totalPages: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Routine = mongoose.model("Routine", routineSchema);
export default Routine;
