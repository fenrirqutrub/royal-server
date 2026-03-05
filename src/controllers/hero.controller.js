// src/controllers/hero.controller.js
import Hero from "../models/hero.model.js";
import { v2 as cloudinary } from "cloudinary";

// Helper function to upload to Cloudinary from buffer
const uploadToCloudinary = async (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "heroes",
        resource_type: "auto",
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else {
          resolve(result);
        }
      },
    );
    uploadStream.end(fileBuffer);
  });
};

// Helper function to generate next uniqueID
const generateUniqueID = async () => {
  try {
    // Find the last hero sorted by uniqueID in descending order
    const lastHero = await Hero.findOne()
      .sort({ uniqueID: -1 })
      .select("uniqueID")
      .lean();

    if (!lastHero) {
      return "hero-1";
    }

    // Extract the number from the last uniqueID (e.g., "hero-5" -> 5)
    const lastNumber = parseInt(lastHero.uniqueID.split("-")[1]);
    const nextNumber = lastNumber + 1;

    return `hero-${nextNumber}`;
  } catch (error) {
    console.error("Error generating uniqueID:", error);
    throw new Error("Failed to generate unique ID");
  }
};

// @desc    Create a new hero
// @route   POST /api/heroes
// @access  Public
export const createHero = async (req, res) => {
  try {
    const { title } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image file is required",
      });
    }

    // Generate unique ID automatically
    const uniqueID = await generateUniqueID();

    // Upload image to Cloudinary from buffer
    const cloudinaryResult = await uploadToCloudinary(req.file.buffer);

    // Create hero in database
    const hero = await Hero.create({
      title,
      uniqueID,
      imageUrl: cloudinaryResult.secure_url,
      imagePublicId: cloudinaryResult.public_id,
    });

    res.status(201).json({
      success: true,
      message: "Hero created successfully",
      data: hero,
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A hero with this uniqueID already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get all heroes
// @route   GET /api/heroes
// @access  Public
export const getAllHeroes = async (req, res) => {
  try {
    const heroes = await Hero.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: heroes.length,
      data: heroes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get single hero by ID
// @route   GET /api/heroes/:id
// @access  Public
export const getHeroById = async (req, res) => {
  try {
    const hero = await Hero.findById(req.params.id);

    if (!hero) {
      return res.status(404).json({
        success: false,
        message: "Hero not found",
      });
    }

    res.status(200).json({
      success: true,
      data: hero,
    });
  } catch (error) {
    // Handle invalid ObjectId
    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        message: "Hero not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get hero by uniqueID
// @route   GET /api/heroes/unique/:uniqueID
// @access  Public
export const getHeroByUniqueId = async (req, res) => {
  try {
    const hero = await Hero.findOne({ uniqueID: req.params.uniqueID });

    if (!hero) {
      return res.status(404).json({
        success: false,
        message: `Hero with uniqueID "${req.params.uniqueID}" not found`,
      });
    }

    res.status(200).json({
      success: true,
      data: hero,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Delete hero
// @route   DELETE /api/heroes/:id
// @access  Public
export const deleteHero = async (req, res) => {
  try {
    const hero = await Hero.findById(req.params.id);

    if (!hero) {
      return res.status(404).json({
        success: false,
        message: "Hero not found",
      });
    }

    // Delete image from Cloudinary
    try {
      await cloudinary.uploader.destroy(hero.imagePublicId);
    } catch (cloudinaryError) {
      console.error("Cloudinary deletion error:", cloudinaryError);
      // Continue with database deletion even if Cloudinary fails
    }

    // Delete from database
    await Hero.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Hero deleted successfully",
      data: {},
    });
  } catch (error) {
    // Handle invalid ObjectId
    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        message: "Hero not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Update hero
// @route   PUT /api/heroes/:id
// @access  Public
export const updateHero = async (req, res) => {
  try {
    const { title } = req.body;

    const hero = await Hero.findById(req.params.id);

    if (!hero) {
      return res.status(404).json({
        success: false,
        message: "Hero not found",
      });
    }

    // Update title if provided
    if (title) hero.title = title;

    // Handle image update if new file uploaded
    if (req.file) {
      // Delete old image from Cloudinary
      try {
        await cloudinary.uploader.destroy(hero.imagePublicId);
      } catch (cloudinaryError) {
        console.error("Cloudinary deletion error:", cloudinaryError);
      }

      // Upload new image from buffer
      const cloudinaryResult = await uploadToCloudinary(req.file.buffer);

      hero.imageUrl = cloudinaryResult.secure_url;
      hero.imagePublicId = cloudinaryResult.public_id;
    }

    await hero.save();

    res.status(200).json({
      success: true,
      message: "Hero updated successfully",
      data: hero,
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    // Handle invalid ObjectId
    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        message: "Hero not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
