// src/router/auth.routes.js
import express from "express";
import { login, me, logout } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/login", login); // POST /api/auth/login
router.get("/me", me); // GET  /api/auth/me
router.post("/logout", logout); // POST /api/auth/logout

export default router;
