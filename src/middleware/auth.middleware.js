import jwt from "jsonwebtoken";
import crypto from "crypto";
import { HARDCODED_ADMIN } from "../constants/admin.js";

const JWT_SECRET = process.env.JWT_SECRET || "changeme-secret";

const hashFingerprint = (raw) =>
  crypto
    .createHash("sha256")
    .update(raw ?? "")
    .digest("hex")
    .slice(0, 16);

const getFingerprint = (req) => {
  const ua = req.headers["user-agent"] ?? "";
  const lang = req.headers["accept-language"] ?? "";
  return `${ua}|${lang}`;
};

// ── Token verify করো, req.user সেট করো ──────────────────────────────────────
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) return res.status(401).json({ message: "লগইন করুন" });

    const decoded = jwt.verify(token, JWT_SECRET);

    // fingerprint check
    const currentFp = hashFingerprint(getFingerprint(req));
    if (decoded.fp && decoded.fp !== currentFp)
      return res.status(401).json({ message: "সেশন মেয়াদোত্তীর্ণ" });

    // hardcoded admin হলে HARDCODED_ADMIN থেকে slug নাও
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
    return res.status(401).json({ message: "সেশন মেয়াদোত্তীর্ণ" });
  }
};

// ── Manager roles — সব data দেখতে পারবে ──────────────────────────────────────
export const MANAGER_ROLES = ["principal", "admin", "owner"];

export const isManager = (role) => MANAGER_ROLES.includes(role);
