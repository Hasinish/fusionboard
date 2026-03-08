import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getAllUsers } from "../controllers/userController.js";

const router = express.Router();

// get all users in the system
router.get("/", authMiddleware, getAllUsers);

export default router;