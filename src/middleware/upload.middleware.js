// src/middleware/upload.middleware.js
import multer from "multer";
import sharp from "sharp";
import path from "path";

// ─── General Upload Config (from upload.middleware.js) ────────────────────────
const generalStorage = multer.memoryStorage();

const generalFileFilter = (req, file, cb) => {
  // ✅ webp input ও accept করো (যদিও সব output webp হবে)
  const allowed = /jpeg|jpg|png|gif|webp|avif|tiff|bmp/;
  const extname = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowed.test(file.mimetype);
  if (mimetype && extname) cb(null, true);
  else cb(new Error("Only image files are allowed"));
};

const generalUpload = multer({
  storage: generalStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: generalFileFilter,
});

// ─── Hero Upload Config (from heroUpload.middleware.js) ───────────────────────
const heroStorage = multer.memoryStorage();

const heroFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    return cb(null, true);
  }
  cb(new Error("Only image files are allowed"));
};

const heroUpload = multer({
  storage: heroStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: heroFileFilter,
});

// ─── General Exports (from upload.middleware.js) ──────────────────────────────

// multiple images (field name: "images") — used by photography, weekly-exam etc.
export const uploadMultiple = generalUpload.array("images", 10);

// single image (field name: "img") — legacy single upload
export const uploadSingle = generalUpload.single("img");

// single image (field name: "avatar")
export const uploadAvatar = generalUpload.single("avatar");

// single image (field name: "image") — used by avatar upload
export const uploadSingleImage = generalUpload.single("image");

// ─── Hero Exports (from heroUpload.middleware.js) ─────────────────────────────

// Single file upload for hero
export const uploadHeroImage = heroUpload.single("img");

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

// ─── Error Handlers ───────────────────────────────────────────────────────────

// General error handler (from upload.middleware.js)
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE")
      return res
        .status(400)
        .json({ message: "File size too large. Maximum size is 10MB." });
    if (err.code === "LIMIT_FILE_COUNT")
      return res
        .status(400)
        .json({ message: "Too many files. Maximum 10 files allowed." });
    return res.status(400).json({ message: err.message });
  } else if (err) {
    return res
      .status(400)
      .json({ message: err.message || "File upload error" });
  }
  next();
};

// Hero error handler (from heroUpload.middleware.js) — 5MB limit message আলাদা
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
