import express from "express";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/security.js";
import { aiChat, clearChatHistory, getChatHistory } from "../services/aiService.js";

const router = express.Router();

router.post("/chat", optionalAuthMiddleware, async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const userId = req.user?._id?.toString() || "anonymous";
    
    const response = await aiChat(userId, message, {
      ...context,
      role: req.user?.role || "guest",
      page: context?.page || "unknown"
    });

    res.json(response);
  } catch (err) {
    console.error("AI chat error:", err);
    res.status(500).json({ error: "Failed to process message" });
  }
});

router.get("/history", authMiddleware, async (req, res) => {
  try {
    const history = getChatHistory(req.user._id.toString());
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

router.delete("/history", authMiddleware, async (req, res) => {
  try {
    clearChatHistory(req.user._id.toString());
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear history" });
  }
});

router.get("/suggestions", (req, res) => {
  const suggestions = [
    "How do I check my balance?",
    "How do I send Nano?",
    "What are the fees?",
    "How do I receive payments?",
    "Is ChangeAIPay secure?"
  ];
  
  res.json({ suggestions });
});

export default router;