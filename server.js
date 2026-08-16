// ========================= SERVER.JS =========================
import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/db.js";
import ChatMessage from "./models/chatMessage.model.js";
import Conversation from "./models/conversation.model.js";
import Notification from "./models/notification.model.js";
import User from "./models/user.model.js";

connectDB();

const server = http.createServer(app);

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("🔌 User connected to Socket:", socket.id);

  // User joins room named after user ID or conversation ID
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    console.log(`👤 Socket ${socket.id} joined room: ${roomId}`);
  });

  // Real-time message broadcasting
  socket.on("send_message", async (data) => {
    try {
      const { conversationId, senderId, text } = data;
      if (!conversationId || !senderId || !text) return;

      const conversation = await Conversation.findById(conversationId);
      if (!conversation || conversation.status !== "accepted") return;

      const newMsg = await ChatMessage.create({
        conversation: conversationId,
        sender: senderId,
        text: text.trim(),
      });

      conversation.messageCount += 1;
      conversation.lastMessage = text.trim();
      conversation.lastMessageAt = new Date();
      await conversation.save();

      const populatedMsg = await ChatMessage.findById(newMsg._id).populate(
        "sender",
        "name role avatar"
      );

      // Broadcast to room
      io.to(conversationId).emit("receive_message", populatedMsg);
      // Notify dealer / buyer room
      io.to(conversation.buyer.toString()).emit("chat_notification", populatedMsg);
      io.to(conversation.dealer.toString()).emit("chat_notification", populatedMsg);

      // Save notification to DB for recipient
      try {
        const recipientId =
          conversation.buyer.toString() === senderId.toString()
            ? conversation.dealer
            : conversation.buyer;

        const senderUser = await User.findById(senderId).select("name avatar");
        const senderName = senderUser?.name || "User";

        await Notification.create({
          userId: recipientId,
          type: "new_message",
          title: `Message from ${senderName} 💬`,
          message: text.trim().length > 80 ? text.trim().slice(0, 80) + "..." : text.trim(),
          metadata: {
            conversationId: conversation._id,
            senderId,
            senderName,
            senderAvatar: senderUser?.avatar,
          },
        });
      } catch (notifErr) {
        console.error("Socket notification error:", notifErr);
      }

    } catch (err) {
      console.error("Socket send_message error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected from Socket:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Server with Socket.io running on http://localhost:${PORT}`)
);