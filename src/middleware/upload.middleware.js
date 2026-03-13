// src/middleware/upload.middleware.js
import multer from "multer";
import path from "path";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // ✅ webp input ও accept করো (যদিও সব output webp হবে)
  const allowed = /jpeg|jpg|png|gif|webp|avif|tiff|bmp/;
  const extname = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowed.test(file.mimetype);
  if (mimetype && extname) cb(null, true);
  else cb(new Error("Only image files are allowed"));
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

// multiple images (field name: "images") — used by photography, weekly-exam etc.
export const uploadMultiple = upload.array("images", 10);

// single image (field name: "img") — legacy single upload
export const uploadSingle = upload.single("img");

// single image (field name: "image") — used by avatar upload
export const uploadSingleImage = upload.single("image");

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
