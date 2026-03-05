// src/config/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// শুধু production-এ log করুন
if (process.env.NODE_ENV !== "production") {
  console.log("Cloudinary config loaded:");
  console.log("  cloud_name:", process.env.CLOUDINARY_CLOUD_NAME);
  console.log(
    "  api_key   :",
    process.env.CLOUDINARY_API_KEY?.slice(0, 4) + "...",
  );
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = (fileBuffer, folder = "uploads") => {
  return new Promise((resolve, reject) => {
    if (!fileBuffer || fileBuffer.length === 0) {
      return reject(new Error("Empty buffer"));
    }

    const timeout = setTimeout(() => {
      reject(new Error("Cloudinary upload timed out after 60s"));
    }, 60000);

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
      (error, result) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve(result);
      },
    );

    uploadStream.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    uploadStream.end(fileBuffer);
  });
};

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
