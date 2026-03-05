// src/controllers/photography.controller.js
import {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
} from "../config/cloudinary.js";
import { Photography } from "../models/photography.model.js";
import mongoose from "mongoose";

/**
 * POST /api/photography
 * Upload multiple photos to Cloudinary
 */
export const uploadPhotos = async (req, res) => {
  console.log("→ uploadPhotos called");
  console.log("Files received:", req.files?.length || 0);

  try {
    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "No images provided. Please select at least one image.",
      });
    }

    // Validate file count (max 10 images at once)
    if (req.files.length > 10) {
      return res.status(400).json({
        message: "Maximum 10 images allowed per upload",
      });
    }

    const uploadPromises = req.files.map(async (file) => {
      try {
        // Upload to Cloudinary using buffer (memory storage)
        const result = await uploadToCloudinary(file.buffer, "photography");

        // Create database entry
        const photo = await Photography.create({
          imageUrl: result.secure_url,
          publicId: result.public_id,
          title: file.originalname.split(".")[0], // filename without extension
          width: result.width,
          height: result.height,
          format: result.format,
          size: result.bytes,
          views: 0, // Initialize views to 0
        });

        return {
          success: true,
          data: photo,
        };
      } catch (error) {
        console.error("Single file upload error:", error);
        return {
          success: false,
          filename: file.originalname,
          error: error.message,
        };
      }
    });

    // Wait for all uploads to complete
    const results = await Promise.all(uploadPromises);

    // Separate successful and failed uploads
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    // Send response
    if (successful.length === 0) {
      return res.status(500).json({
        message: "All uploads failed",
        failed,
      });
    }

    res.status(201).json({
      message: `Successfully uploaded ${successful.length} photo(s)`,
      data: successful.map((r) => r.data),
      failed: failed.length > 0 ? failed : undefined,
      summary: {
        total: req.files.length,
        successful: successful.length,
        failed: failed.length,
      },
    });
  } catch (err) {
    console.error("UPLOAD PHOTOS ERROR:", err);
    res.status(500).json({
      message: "Failed to upload photos",
      error: err.message,
    });
  }
};

/**
 * GET /api/photography
 * Get all photos (with pagination)
 */
export const getPhotos = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [photos, total] = await Promise.all([
      Photography.find({ isActive: true })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Photography.countDocuments({ isActive: true }),
    ]);

    res.json({
      data: photos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + photos.length < total,
      },
    });
  } catch (err) {
    console.error("GET PHOTOS ERROR:", err);
    res.status(500).json({
      message: "Failed to fetch photos",
    });
  }
};

/**
 * GET /api/photography/admin
 * Get all photos for admin (including inactive)
 */
export const getPhotosAdmin = async (req, res) => {
  try {
    const photos = await Photography.find().sort({ createdAt: -1 }).lean();

    res.json({
      data: photos,
      total: photos.length,
    });
  } catch (err) {
    console.error("GET PHOTOS ADMIN ERROR:", err);
    res.status(500).json({
      message: "Failed to fetch photos",
    });
  }
};

/**
 * GET /api/photography/:id
 * Get single photo
 */
export const getPhoto = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid photo ID" });
    }

    const photo = await Photography.findById(id);

    if (!photo) {
      return res.status(404).json({ message: "Photo not found" });
    }

    res.json({ data: photo });
  } catch (err) {
    console.error("GET PHOTO ERROR:", err);
    res.status(500).json({
      message: "Failed to fetch photo",
    });
  }
};

/**
 * POST /api/photography/:id/view
 * Increment view count
 */
export const incrementView = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid photo ID" });
    }

    const photo = await Photography.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true },
    );

    if (!photo) {
      return res.status(404).json({ message: "Photo not found" });
    }

    res.json({
      message: "View count incremented",
      views: photo.views,
    });
  } catch (err) {
    console.error("INCREMENT VIEW ERROR:", err);
    res.status(500).json({
      message: "Failed to increment view count",
      error: err.message,
    });
  }
};

/**
 * PATCH /api/photography/:id
 * Update photo details
 */
export const updatePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, tags, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid photo ID" });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (tags !== undefined) updateData.tags = tags;
    if (isActive !== undefined) updateData.isActive = isActive;

    const photo = await Photography.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!photo) {
      return res.status(404).json({ message: "Photo not found" });
    }

    res.json({
      message: "Photo updated successfully",
      data: photo,
    });
  } catch (err) {
    console.error("UPDATE PHOTO ERROR:", err);
    res.status(500).json({
      message: "Failed to update photo",
    });
  }
};

/**
 * DELETE /api/photography/:id
 * Delete photo (from both Cloudinary and DB)
 */
export const deletePhoto = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid photo ID" });
    }

    const photo = await Photography.findById(id);

    if (!photo) {
      return res.status(404).json({ message: "Photo not found" });
    }

    // Delete from Cloudinary
    try {
      const cloudinary = (await import("../config/cloudinary.js")).default;
      await cloudinary.uploader.destroy(photo.publicId);
      console.log(`✅ Deleted from Cloudinary: ${photo.publicId}`);
    } catch (cloudinaryErr) {
      console.error("Cloudinary deletion error:", cloudinaryErr);
      // Continue with DB deletion even if Cloudinary fails
    }

    // Delete from database
    await Photography.findByIdAndDelete(id);

    res.json({
      message: "Photo deleted successfully",
    });
  } catch (err) {
    console.error("DELETE PHOTO ERROR:", err);
    res.status(500).json({
      message: "Failed to delete photo",
      error: err.message,
    });
  }
};

/**
 * DELETE /api/photography/batch
 * Delete multiple photos
 */
export const deleteBatchPhotos = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        message: "Please provide an array of photo IDs",
      });
    }

    // Validate all IDs
    const invalidIds = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        message: "Invalid photo IDs provided",
        invalidIds,
      });
    }

    // Get all photos
    const photos = await Photography.find({ _id: { $in: ids } });

    if (photos.length === 0) {
      return res.status(404).json({ message: "No photos found" });
    }

    // Delete from Cloudinary
    const cloudinary = (await import("../config/cloudinary.js")).default;
    const cloudinaryDeletePromises = photos.map((photo) =>
      cloudinary.uploader.destroy(photo.publicId).catch((err) => {
        console.error(`Failed to delete ${photo.publicId}:`, err);
        return { error: err.message };
      }),
    );

    await Promise.all(cloudinaryDeletePromises);

    // Delete from database
    const result = await Photography.deleteMany({ _id: { $in: ids } });

    res.json({
      message: `Successfully deleted ${result.deletedCount} photo(s)`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("BATCH DELETE ERROR:", err);
    res.status(500).json({
      message: "Failed to delete photos",
      error: err.message,
    });
  }
};
