// src/controllers/complain.controller.js

import Complain from "../models/complain.model.js";

export const createComplain = async (req, res) => {
  try {
    const { description } = req.body;
    const { id: postedBy, slug } = req.user;

    if (!description || description.trim().length < 10) {
      return res.status(400).json({ message: "কমপক্ষে ১০ অক্ষরের বিবরণ দিন" });
    }

    const complain = await Complain.create({
      description: description.trim(),
      postedBy,
      slug,
    });

    res.status(201).json({ message: "অভিযোগ সফলভাবে জমা হয়েছে", complain });
  } catch (err) {
    console.error("createComplain error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllComplains = async (req, res) => {
  try {
    const complains = await Complain.find()
      .populate("postedBy", "name role slug avatar phone")
      .sort({ createdAt: -1 });

    res.json(complains);
  } catch (err) {
    console.error("getAllComplains error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateComplainStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const complain = await Complain.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true },
    );

    if (!complain) {
      return res.status(404).json({ message: "অভিযোগ পাওয়া যায়নি" });
    }

    res.json({ message: "স্ট্যাটাস আপডেট হয়েছে", complain });
  } catch (err) {
    console.error("updateComplainStatus error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
