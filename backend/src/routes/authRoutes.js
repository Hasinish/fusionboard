import express from "express";
import { register, login, updateMe, googleLogin, getMe } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);

router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateMe);

export default router;