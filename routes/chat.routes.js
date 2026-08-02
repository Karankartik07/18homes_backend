import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  requestChat,
  respondChatRequest,
  getConversations,
  getMessages,
  sendMessage,
} from "../controllers/chat.controller.js";

const router = express.Router();

router.post("/request", protect, requestChat);
router.patch("/request/:conversationId", protect, respondChatRequest);
router.get("/conversations", protect, getConversations);
router.get("/messages/:conversationId", protect, getMessages);
router.post("/messages/:conversationId", protect, sendMessage);

export default router;
