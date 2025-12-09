import express from "express";
import { register, login, updateMe } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);


router.put("/me", authMiddleware, updateMe);

export default router;
