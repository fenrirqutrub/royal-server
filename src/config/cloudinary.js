// src/config/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp"; // ✅ নতুন
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── WebP converter ───────────────────────────────────────────────────────────
const toWebP = async (buffer) => {
  return sharp(buffer)
    .webp({ quality: 85 }) // quality 85 — ভালো balance
    .toBuffer();
};

// ─── single upload (buffer) ───────────────────────────────────────────────────
export const uploadToCloudinary = async (fileBuffer, folder = "uploads") => {
  if (!fileBuffer || fileBuffer.length === 0) throw new Error("Empty buffer");

  const webpBuffer = await toWebP(fileBuffer); // ✅ convert to webp

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Cloudinary upload timed out after 60s"));
    }, 60000);

    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image", format: "webp" }, // ✅ format: webp
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
    stream.end(webpBuffer); // ✅ webp buffer পাঠাও
  });
};

// ─── alias used by avatar upload ─────────────────────────────────────────────
export const uploadSingleToCloudinary = (file, folder = "uploads") =>
  uploadToCloudinary(file.buffer, folder);

// ─── delete by publicId ───────────────────────────────────────────────────────
export const deleteFromCloudinary = (publicId) =>
  cloudinary.uploader.destroy(publicId);

// ─── multiple upload with retry ───────────────────────────────────────────────
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
