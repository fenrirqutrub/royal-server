// src/router/complain.routes.js

import express from "express";
import {
  createComplain,
  getAllComplains,
  updateComplainStatus,
  deleteComplain,
} from "../controllers/complain.controller.js";
import { authenticate, isManager } from "../middleware/auth.middleware.js";

const router = express.Router();

// যেকোনো logged-in user অভিযোগ করতে পারবে
router.post("/", authenticate, createComplain);

// শুধু manager (principal/admin/owner) দেখতে পারবে
router.get(
  "/",
  authenticate,
  (req, res, next) => {
    if (!isManager(req.user.role)) {
      return res.status(403).json({ message: "অনুমতি নেই" });
    }
    next();
  },
  getAllComplains,
);

// শুধু manager স্ট্যাটাস বদলাতে পারবে
router.patch(
  "/:id/status",
  authenticate,
  (req, res, next) => {
    if (!isManager(req.user.role)) {
      return res.status(403).json({ message: "অনুমতি নেই" });
    }
    next();
  },
  updateComplainStatus,
);

// শুধু manager অভিযোগ মুছতে পারবে
router.delete(
  "/:id",
  authenticate,
  (req, res, next) => {
    if (!isManager(req.user.role)) {
      return res.status(403).json({ message: "অনুমতি নেই" });
    }
    next();
  },
  deleteComplain,
);

export default router;
