// src/controllers/auth.controller.js
import jwt from "jsonwebtoken";
import Teacher from "../models/teacher.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "changeme-secret";
const COOKIE_NAME = "royal_token";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const HARDCODED_ADMIN = {
  _id: "hardcoded-admin",
  name: "Super Admin",
  email: "hello@world.com",
  role: "admin",
  password: "admin",
  isHardcoded: true,
  slug: "X666X",
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
    let jwtPayload; // JWT এ avatar রাখব না (অপ্রয়োজনীয় বড় হয়)

    if (
      email.toLowerCase() === HARDCODED_ADMIN.email &&
      password === HARDCODED_ADMIN.password
    ) {
      jwtPayload = {
        id: HARDCODED_ADMIN._id,
        email: HARDCODED_ADMIN.email,
        name: HARDCODED_ADMIN.name,
        role: HARDCODED_ADMIN.role,
        slug: HARDCODED_ADMIN.slug,
        isHardcoded: true,
      };
      userPayload = {
        ...jwtPayload,
        avatar: { url: null, publicId: null }, // ✅ hardcoded admin has no avatar
      };
    } else {
      const teacher = await Teacher.findOne({ email: email.toLowerCase() });
      if (!teacher || teacher.password !== password)
        return res.status(401).json({ message: "Invalid credentials" });

      jwtPayload = {
        id: teacher._id.toString(),
        email: teacher.email,
        name: teacher.name,
        role: teacher.role,
        slug: teacher.slug ?? "",
        isHardcoded: false,
      };
      userPayload = {
        ...jwtPayload,
        avatar: teacher.avatar ?? { url: null, publicId: null }, // ✅ avatar include
      };
    }

    const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: "7d" });
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

    if (decoded.id === HARDCODED_ADMIN._id) {
      return res.status(200).json({
        user: {
          id: HARDCODED_ADMIN._id,
          email: HARDCODED_ADMIN.email,
          name: HARDCODED_ADMIN.name,
          role: HARDCODED_ADMIN.role,
          slug: HARDCODED_ADMIN.slug,
          isHardcoded: true,
          avatar: { url: null, publicId: null }, // ✅ always send avatar field
        },
      });
    }

    // DB থেকে fresh data নাও — এখানেই avatar আসবে
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
        avatar: teacher.avatar ?? { url: null, publicId: null }, // ✅ এটাই আগে missing ছিল
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
