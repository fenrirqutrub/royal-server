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
