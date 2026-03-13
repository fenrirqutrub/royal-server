// src/middleware/heroUpload.middleware.js
import multer from "multer";
import sharp from "sharp";

// Memory storage - Vercel-এ disk storage কাজ করবে না
const storage = multer.memoryStorage();

// File filter - সব ধরনের image accept করো
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    return cb(null, true);
  }
  cb(new Error("Only image files are allowed"));
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

// Landscape validation + WebP conversion
export const validateLandscapeImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image file is required",
      });
    }

    // Buffer থেকে metadata read করো
    const metadata = await sharp(req.file.buffer).metadata();
    const { width, height } = metadata;
    const aspectRatio = width / height;
    const minAspectRatio = 1.3;

    if (aspectRatio < minAspectRatio) {
      return res.status(400).json({
        success: false,
        message: "Only proper landscape/horizontal images are allowed",
        uploaded: {
          width,
          height,
          aspectRatio: aspectRatio.toFixed(2),
        },
        requirement: `Image must be horizontal with aspect ratio at least ${minAspectRatio} (e.g., 16:9 = 1.78, 4:3 = 1.33)`,
      });
    }

    // ✅ WebP-তে convert করো
    req.file.buffer = await sharp(req.file.buffer)
      .webp({ quality: 85 })
      .toBuffer();
    req.file.mimetype = "image/webp";
    req.file.originalname = req.file.originalname.replace(/\.[^.]+$/, ".webp");

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error processing image",
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
