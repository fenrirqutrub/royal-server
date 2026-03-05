// src/middleware/heroUpload.middleware.js
import multer from "multer";
import path from "path";
import sharp from "sharp";

// Memory storage ব্যবহার করুন - Vercel-এ disk storage কাজ করবে না
const storage = multer.memoryStorage();

// File filter - শুধু PNG, JPG, JPEG
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];

  if (allowedTypes.includes(file.mimetype)) {
    return cb(null, true);
  } else {
    cb(new Error("Only PNG, JPG, and JPEG files are allowed"));
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: fileFilter,
});

// Single file upload for hero
export const uploadHeroImage = upload.single("img");

// Landscape validation - buffer থেকে directly check
export const validateLandscapeImage = async (req, res, next) => {
  console.log("🔍 Validation middleware called!");
  console.log("📁 File:", req.file);

  try {
    if (!req.file) {
      console.log("❌ No file found");
      return res.status(400).json({
        success: false,
        message: "Image file is required",
      });
    }

    // Buffer থেকে metadata read করুন
    const metadata = await sharp(req.file.buffer).metadata();
    const width = metadata.width;
    const height = metadata.height;

    console.log("📏 Image dimensions:", width, "x", height);

    // Calculate aspect ratio (width/height)
    const aspectRatio = width / height;

    console.log("📐 Aspect ratio:", aspectRatio.toFixed(2));

    // Minimum aspect ratio for proper landscape
    const minAspectRatio = 1.3; // Mane width at least 30% boro hote hobe height theke

    // Check if truly landscape
    if (aspectRatio < minAspectRatio) {
      console.log("❌ Not proper landscape - ratio too low");

      return res.status(400).json({
        success: false,
        message: "Only proper landscape/horizontal images are allowed",
        uploaded: {
          width: width,
          height: height,
          aspectRatio: aspectRatio.toFixed(2),
          orientation:
            aspectRatio >= minAspectRatio ? "landscape ✓" : "not landscape ✗",
        },
        requirement: `Image must be horizontal with aspect ratio at least ${minAspectRatio} (e.g., 16:9 = 1.78, 4:3 = 1.33, etc.)`,
      });
    }

    console.log("✅ Validation passed!");
    next();
  } catch (error) {
    console.log("💥 Validation error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Error validating image orientation",
      error: error.message,
    });
  }
};

// Error handling middleware
export const handleHeroUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB.",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "File upload error",
    });
  }
  next();
};
