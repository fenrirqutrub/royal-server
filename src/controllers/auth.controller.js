// src/controllers/auth.controller.js
import jwt from "jsonwebtoken";
import Teacher from "../models/teacher.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "changeme-secret";
const COOKIE_NAME = "royal_token";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ─── Single source of truth for hardcoded admin ───────────────────────────────
// ⚠️  Keep this in sync with teacher.controller.js
const HARDCODED_ADMIN = {
  _id: "hardcoded-admin",
  name: "Super Admin",
  email: "hello@world.com",
  role: "admin",
  password: "admin",
  isHardcoded: true,
  slug: "X666X", // must match teacher.controller.js
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });

    let userPayload;

    if (
      email.toLowerCase() === HARDCODED_ADMIN.email &&
      password === HARDCODED_ADMIN.password
    ) {
      // ✅ isHardcoded goes into the JWT so /me can return it
      userPayload = {
        id: HARDCODED_ADMIN._id,
        email: HARDCODED_ADMIN.email,
        name: HARDCODED_ADMIN.name,
        role: HARDCODED_ADMIN.role,
        slug: HARDCODED_ADMIN.slug,
        isHardcoded: true,
      };
    } else {
      const teacher = await Teacher.findOne({ email: email.toLowerCase() });
      if (!teacher || teacher.password !== password)
        return res.status(401).json({ message: "Invalid credentials" });

      userPayload = {
        id: teacher._id.toString(),
        email: teacher.email,
        name: teacher.name,
        role: teacher.role,
        slug: teacher.slug ?? "",
        isHardcoded: false,
      };
    }

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: "7d" });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);

    return res.status(200).json({ success: true, user: userPayload });
  } catch (err) {
    return res.status(500).json({ message: "Failed", error: err.message });
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
export const me = async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const decoded = jwt.verify(token, JWT_SECRET);

    // Hardcoded admin — return directly, no DB call needed
    if (decoded.id === HARDCODED_ADMIN._id) {
      return res.status(200).json({
        user: {
          id: HARDCODED_ADMIN._id,
          email: HARDCODED_ADMIN.email,
          name: HARDCODED_ADMIN.name,
          role: HARDCODED_ADMIN.role,
          slug: HARDCODED_ADMIN.slug,
          isHardcoded: true, // ✅ always present
        },
      });
    }

    // DB user — fetch fresh data
    const teacher = await Teacher.findById(decoded.id).select("-password");
    if (!teacher) return res.status(401).json({ message: "User not found" });

    return res.status(200).json({
      user: {
        id: teacher._id.toString(),
        email: teacher.email,
        name: teacher.name,
        role: teacher.role,
        slug: teacher.slug ?? "",
        isHardcoded: false,
      },
    });
  } catch (err) {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ message: "Invalid or expired session" });
  }
};

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
export const logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
  return res.status(200).json({ success: true, message: "Logged out" });
};
