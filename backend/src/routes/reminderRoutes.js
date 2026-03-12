import express from "express";
import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
} from "../controllers/reminderController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getReminders);
router.post("/", createReminder);
router.put("/:id", updateReminder);
router.delete("/:id", deleteReminder);

export default router;
