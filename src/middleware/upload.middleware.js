// src/middleware/upload.middleware.js
import multer from "multer";
import path from "path";

// Memory storage ব্যবহার করুন - Vercel-এ disk storage কাজ করবে না
const storage = multer.memoryStorage();

// File filter - only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 5MB per file
  },
  fileFilter: fileFilter,
});

// Middleware to handle multiple file uploads
export const uploadMultiple = upload.array("images", 10); // max 10 images

// Middleware to handle single file upload (for backward compatibility)
export const uploadSingle = upload.single("img");

// Error handling middleware for multer
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File size too large. Maximum size is 5MB per file.",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        message: "Too many files. Maximum 10 files allowed.",
      });
    }
    return res.status(400).json({
      message: err.message,
    });
  } else if (err) {
    return res.status(400).json({
      message: err.message || "File upload error",
    });
  }
  next();
};
