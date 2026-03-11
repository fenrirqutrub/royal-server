// src/router/notice.routes.js
import express from "express";
import {
  createNotice,
  getActiveNotice,
  getAllNotices,
  getNoticePdf,
  deleteNotice,
} from "../controllers/notice.controller.js";

const router = express.Router();

router.post("/", createNotice);
router.get("/active", getActiveNotice);
router.get("/", getAllNotices);
router.get("/:slug/pdf", getNoticePdf);
router.delete("/:slug", deleteNotice);

export default router;
