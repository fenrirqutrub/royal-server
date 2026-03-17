// index.js — add these lines to your existing file

process.on("uncaughtException", (err) =>
  console.error("💥 UNCAUGHT EXCEPTION:", err),
);
process.on("unhandledRejection", (reason) =>
  console.error("💥 UNHANDLED REJECTION:", reason),
);

import dotenv from "dotenv";
dotenv.config();

import cookieParser from "cookie-parser";
import express from "express";
import connectDB from "./src/config/db.js";
import corsMiddleware from "./src/middleware/corsMiddleware.js";
import authRoutes from "./src/router/auth.routes.js";
import dailyLessonRoutes from "./src/router/daily.lesson.routes.js";
import heroRoutes from "./src/router/hero.routes.js";
import noticeRoutes from "./src/router/notice.routes.js";
import photographyRoutes from "./src/router/photography.routes.js";
import quoteRoutes from "./src/router/quotes.routes.js";
import teacherProfileRoutes from "./src/router/teacher.routes.js";
import weeklyExamRoutes from "./src/router/weekly.exam.routes.js";

const app = express();
const port = process.env.PORT || 5000;

// ── middleware ────────────────────────────────────────────────────────────────
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // ✅ NEW — must be before routes

// request logger
app.use((req, res, next) => {
  console.log(`\n📥 ${req.method} ${req.url}`);
  next();
});

// ── db ────────────────────────────────────────────────────────────────────────
connectDB();

// ── routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes); // ✅ NEW
app.use("/api/photography", photographyRoutes);
app.use("/api/quotes", quoteRoutes);
app.use("/api/heroes", heroRoutes);
app.use("/api/weekly-exams", weeklyExamRoutes);
app.use("/api/teachers", teacherProfileRoutes);
app.use("/api/daily-lesson", dailyLessonRoutes);
app.use("/api/notices", noticeRoutes);

// ── health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) =>
  res.json({
    message: "royal server is running",
    port,
    timestamp: new Date().toISOString(),
  }),
);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ message: "❌ Route not found", path: req.url }),
);

// ── global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ── listen ────────────────────────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
  console.log(`http://localhost:${port}`);
});

// ✅ Vercel এর জন্য export
export default app;
