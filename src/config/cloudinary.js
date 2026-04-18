// src/config/cloudinary.js — simplified, no sharp needed for weekly-exam

import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp"; // ✅ Keep for avatar/hero (server-side upload)
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── WebP converter (only for server-side uploads like avatar) ─────────────
const toWebP = async (buffer) => {
  return sharp(buffer).webp({ quality: 85 }).toBuffer();
};

// ── Server-side upload (avatar, hero — NOT weekly-exam) ───────────────────
export const uploadToCloudinary = async (fileBuffer, folder = "uploads") => {
  if (!fileBuffer || fileBuffer.length === 0) throw new Error("Empty buffer");

  const webpBuffer = await toWebP(fileBuffer);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Cloudinary upload timed out after 120s"));
    }, 120000);

    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image", format: "webp" },
      (error, result) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve(result);
      },
    );

    stream.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    stream.end(webpBuffer);
  });
};

export const uploadSingleToCloudinary = (file, folder = "uploads") =>
  uploadToCloudinary(file.buffer, folder);

export const deleteFromCloudinary = (publicId) =>
  cloudinary.uploader.destroy(publicId);

// ── Multiple upload — only for server-side needs ──────────────────────────
const uploadWithRetry = async (fileBuffer, folder, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await uploadToCloudinary(fileBuffer, folder);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((res) => setTimeout(res, attempt * 1000));
    }
  }
};

export const uploadMultipleToCloudinary = async (files, folder = "uploads") => {
  const results = [];
  for (const file of files) {
    const result = await uploadWithRetry(file.buffer, folder);
    results.push(result);
  }
  return results;
};

export default cloudinary;
