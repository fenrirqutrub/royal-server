// src/routes/article.routes.js
import express from "express";
import multer from "multer";
import sharp from "sharp";
import cloudinary from "../config/cloudinary.js";
import {
  createArticle,
  getArticles,
  getArticleById,
  deleteArticle,
  getComments,
  addComment,
  incrementView,
} from "../controllers/article.controller.js";

const router = express.Router();
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ─── Multer (memory only – no disk) ───
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed"), false);
    }
  },
});

// ─── Custom Cloudinary + validation middleware ───
const processAndUploadImage = async (req, res, next) => {
  console.log("[IMAGE PROCESS] Starting");
  console.log(" Has file? ", !!req.file);
  console.log(" File name ", req.file?.originalname);
  console.log(" File size ", req.file?.size);
  console.log(" MIME type ", req.file?.mimetype);

  if (!req.file) {
    console.log("[IMAGE PROCESS] No file received → skipping");
    return next();
  }

  try {
    console.log("[IMAGE PROCESS] Running sharp.metadata()");
    const metadata = await sharp(req.file.buffer).metadata();
    console.log("[IMAGE PROCESS] Metadata:", metadata);

    // Only horizontal images allowed
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width <= metadata.height
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only horizontal images are allowed (width must be greater than height)",
      });
    }

    if (metadata.width < 400) {
      console.warn(
        `Small image uploaded: ${metadata.width}x${metadata.height}`,
      );
    }

    const optimizedBuffer = await sharp(req.file.buffer)
      .resize({
        width: 1920,
        height: 1080,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer();

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "articles",
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
          transformation: [{ quality: "auto:good" }],
        },
        (error, result) => (error ? reject(error) : resolve(result)),
      );
      stream.end(optimizedBuffer);
    });

    console.log("[IMAGE PROCESS] Upload successful:", result.secure_url);
    req.cloudinaryResult = {
      url: result.secure_url,
      public_id: result.public_id,
    };
    next();
  } catch (err) {
    console.error("[IMAGE PROCESS] FAILED:", err.name, err.message);
    console.error(err.stack);
    return res.status(500).json({
      success: false,
      message: "Image processing failed",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// ─── Article Routes ───
router.post("/", upload.single("img"), processAndUploadImage, createArticle);
router.get("/", getArticles);

// ✅ UPDATED: Use :identifier instead of :id
// This allows both MongoDB _id and uniqueId to work
router.post("/:identifier/view", incrementView);
router.post("/:identifier/comments", addComment);
router.get("/:identifier/comments", getComments);

// ✅ Generic :identifier routes come LAST
router.get("/:identifier", getArticleById);
router.delete("/:identifier", deleteArticle);

// ─── Multer error handler ───
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ success: false, message: "Image must be < 5MB" });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err)
    return res.status(400).json({ success: false, message: err.message });
  next();
});

export default router;
