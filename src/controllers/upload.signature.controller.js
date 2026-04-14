// src/controllers/upload.signature.controller.js
import { v2 as cloudinary } from "cloudinary";

export const getUploadSignature = (req, res) => {
  const { folder = "uploads" } = req.query;

  const timestamp = Math.round(new Date().getTime() / 1000);

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET,
  );

  return res.json({
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder,
  });
};
