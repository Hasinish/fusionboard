import Reminder from "../models/Reminder.js";
import Workspace from "../models/Workspace.js";

async function getRole(userId, workspaceId) {
  const ws = await Workspace.findById(workspaceId);
  if (!ws) return null;
  const member = ws.members.find(m => m.user.toString() === userId.toString());
  return member ? member.role : null;
}

export const getReminders = async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) {
      return res.status(400).json({ message: "workspaceId is required" });
    }
    
    // Check if user is a member
    const role = await getRole(req.userId, workspaceId);
    if (!role) {
      return res.status(403).json({ message: "Access denied" });
    }

    const reminders = await Reminder.find({ workspaceId }).sort({ date: 1 });
    res.json(reminders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createReminder = async (req, res) => {
  try {
    const { workspaceId, title, description, date, color } = req.body;
    const userId = req.userId;

    if (!workspaceId || !title || !date) {
      return res.status(400).json({ message: "workspaceId, title, and date are required" });
    }

    // Check RBAC
    const role = await getRole(userId, workspaceId);
    if (role !== "owner" && role !== "editor") {
      return res.status(403).json({ message: "Only owners and editors can create reminders" });
    }

    const reminder = new Reminder({
      userId,
      workspaceId,
      title,
      description,
      date,
      color: color || "#244e8a",
    });

    await reminder.save();
    res.status(201).json(reminder);
  } catch (error) {
    res.status(500).json({ message: error.message || "Server error" });
  }
};

export const updateReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, date, completed, color } = req.body;

    const reminder = await Reminder.findById(id);
    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" });
    }

    // Check RBAC
    const role = await getRole(req.userId, reminder.workspaceId);
    if (role !== "owner" && role !== "editor") {
      return res.status(403).json({ message: "Only owners and editors can edit reminders" });
    }

    if (title !== undefined) reminder.title = title;
    if (description !== undefined) reminder.description = description;
    if (date !== undefined) reminder.date = date;
    if (completed !== undefined) reminder.completed = completed;
    if (color !== undefined) reminder.color = color;

    await reminder.save();
    res.json(reminder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const reminder = await Reminder.findById(id);
    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" });
    }

    // Check RBAC
    const role = await getRole(req.userId, reminder.workspaceId);
    if (role !== "owner" && role !== "editor") {
      return res.status(403).json({ message: "Only owners and editors can delete reminders" });
    }

    await Reminder.deleteOne({ _id: id });
    res.json({ message: "Reminder deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
