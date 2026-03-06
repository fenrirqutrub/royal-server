// index.js side of .env

process.on("uncaughtException", (err) => {
  console.error("💥 UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("💥 UNHANDLED REJECTION:", reason);
});

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import corsMiddleware from "./src/middleware/corsMiddleware.js";
import connectDB from "./src/config/db.js";
import photographyRoutes from "./src/router/photography.routes.js";
import quoteRoutes from "./src/router/quotes.routes.js";
import heroRoutes from "./src/router/hero.routes.js";
import weeklyExamRoutes from "./src/router/weekly.exam.router.js";
import teacherProfileRoutes from "./src/router/teacher.profile.routes.js";

const app = express();
const port = process.env.PORT || 5000;

//  global middleware
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Request Logger (for debugging)
app.use((req, res, next) => {
  console.log(`\n📥 ${req.method} ${req.url}`);
  console.log("Headers:", req.headers["content-type"]);
  console.log("Body:", req.body);
  next();
});

// ======================
//  db
connectDB();
// ======================

// ======================
// Routes
app.use("/api/photography", photographyRoutes);
app.use("/api/quotes", quoteRoutes);
app.use("/api/heroes", heroRoutes);

app.use("/api/weekly-exams", weeklyExamRoutes);
app.use("/api/teacher", teacherProfileRoutes);

// ======================

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "royal server is running",
    port,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: "❌ Route not found",
    path: req.url,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ======================
// Server listen
// ======================
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
  console.log(`http://localhost:${port}`);
});
