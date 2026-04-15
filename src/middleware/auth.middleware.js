import jwt from "jsonwebtoken";
import { HARDCODED_ADMIN } from "../constants/admin.js";

const JWT_SECRET = process.env.JWT_SECRET || "changeme-secret";

// ── Token verify করো, req.user সেট করো ──────────────────────────────────────
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) return res.status(401).json({ message: "লগইন করুন" });

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.isHardcoded) {
      req.user = {
        id: HARDCODED_ADMIN._id,
        role: HARDCODED_ADMIN.role,
        slug: HARDCODED_ADMIN.slug,
        isHardcoded: true,
      };
    } else {
      req.user = {
        id: decoded.id,
        role: decoded.role,
        slug: decoded.slug ?? null,
        isHardcoded: false,
      };
    }

    next();
  } catch (err) {
    console.log("❌ JWT verify failed:", err.message);
    return res.status(401).json({ message: "সেশন মেয়াদোত্তীর্ণ" });
  }
};

// ── Optional auth — no token? skip silently ──────────────────────────────────
export const authenticateOptional = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    if (!token) return next();

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.isHardcoded) {
      req.user = {
        id: HARDCODED_ADMIN._id,
        role: HARDCODED_ADMIN.role,
        slug: HARDCODED_ADMIN.slug,
        isHardcoded: true,
      };
    } else {
      req.user = {
        id: decoded.id,
        role: decoded.role,
        slug: decoded.slug ?? null,
        isHardcoded: false,
      };
    }
    next();
  } catch {
    next();
  }
};

// ── Manager roles ────────────────────────────────────────────────────────────
export const MANAGER_ROLES = ["principal", "admin", "owner"];
export const isManager = (role) => MANAGER_ROLES.includes(role);
