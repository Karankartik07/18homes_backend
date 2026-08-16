import Conversation from "../models/conversation.model.js";
import ChatMessage from "../models/chatMessage.model.js";
import Property from "../models/property.model.js";
import Notification from "../models/notification.model.js";
import sendResponse from "../utils/apiResponse.js";

/* ======================================================
   1. REQUEST CHAT (BUYER INITIATES CHAT REQUEST)
====================================================== */
export const requestChat = async (req, res) => {
  try {
    const { propertyId, message } = req.body;
    const buyerId = req.user._id;

    if (!propertyId) {
      return sendResponse(res, 400, false, "Property ID is required");
    }

    const property = await Property.findById(propertyId).populate("owner");
    if (!property || !property.isActive) {
      return sendResponse(res, 404, false, "Property not found");
    }

    const dealerId = property.owner?._id || property.owner;
    if (!dealerId) {
      return sendResponse(res, 400, false, "Property owner details missing");
    }

    if (dealerId.toString() === buyerId.toString()) {
      return sendResponse(res, 400, false, "You cannot chat with yourself");
    }

    // Check existing conversation
    let conversation = await Conversation.findOne({
      property: propertyId,
      buyer: buyerId,
      dealer: dealerId,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        property: propertyId,
        buyer: buyerId,
        dealer: dealerId,
        status: "pending",
        lastMessage: message || "Chat Request Sent",
        lastMessageAt: new Date(),
      });
    }

    // If initial message provided, save first message
    if (message && message.trim()) {
      await ChatMessage.create({
        conversation: conversation._id,
        sender: buyerId,
        text: message.trim(),
      });
      conversation.messageCount += 1;
      conversation.lastMessage = message.trim();
      conversation.lastMessageAt = new Date();
      await conversation.save();
    }

    const populatedConv = await Conversation.findById(conversation._id)
      .populate("property", "title price images address")
      .populate("buyer", "name email phone")
      .populate("dealer", "name email phone");

    // Send Notification to recipient (dealer/owner)
    try {
      const senderName = req.user.name || "A user";
      const propTitle = property.title || "property listing";
      await Notification.create({
        userId: dealerId,
        type: "new_message",
        title: `New Chat Request 💬`,
        message: `${senderName} requested to chat regarding "${propTitle}"`,
        metadata: {
          conversationId: conversation._id,
          senderId: buyerId,
          senderName: req.user.name,
          senderAvatar: req.user.avatar,
          propertyTitle: propTitle,
        },
      });
    } catch (notifErr) {
      console.error("Error creating chat request notification:", notifErr);
    }

    return sendResponse(res, 201, true, "Chat request submitted", populatedConv);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   2. RESPOND TO CHAT REQUEST (DEALER APPROVES OR DECLINES)
====================================================== */
export const respondChatRequest = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { action } = req.body; // "accepted" | "rejected"
    const userId = req.user._id;

    if (!["accepted", "rejected"].includes(action)) {
      return sendResponse(res, 400, false, "Invalid action. Use 'accepted' or 'rejected'");
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return sendResponse(res, 404, false, "Conversation not found");
    }

    // Only dealer or admin can approve/decline
    const isAuthorized =
      req.user.role === "admin" ||
      conversation.dealer.toString() === userId.toString();

    if (!isAuthorized) {
      return sendResponse(res, 403, false, "Only property dealer can accept/reject chat request");
    }

    conversation.status = action;
    await conversation.save();

    const updatedConv = await Conversation.findById(conversation._id)
      .populate("property", "title price images address")
      .populate("buyer", "name email phone")
      .populate("dealer", "name email phone");

    return sendResponse(
      res,
      200,
      true,
      `Chat request ${action} successfully`,
      updatedConv
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   3. GET MY CONVERSATIONS (BUYER / DEALER / ADMIN)
====================================================== */
export const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query;

    const filter =
      req.user.role === "admin"
        ? {}
        : {
            $or: [{ buyer: userId }, { dealer: userId }],
          };

    if (status) {
      filter.status = status;
    }

    const conversations = await Conversation.find(filter)
      .populate("property", "title price images address propertyType city state locality priceUnit rentOrSale listingType")
      .populate("buyer", "name email phone avatar role")
      .populate("dealer", "name email phone avatar role")
      .sort({ lastMessageAt: -1 });

    return sendResponse(res, 200, true, "Conversations retrieved", conversations);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   4. GET MESSAGES FOR A CONVERSATION
====================================================== */
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId)
      .populate("property", "title price images address propertyType city state locality priceUnit rentOrSale listingType")
      .populate("buyer", "name email phone avatar role")
      .populate("dealer", "name email phone avatar role");

    if (!conversation) {
      return sendResponse(res, 404, false, "Conversation not found");
    }

    const isMember =
      req.user.role === "admin" ||
      conversation.buyer._id.toString() === userId.toString() ||
      conversation.dealer._id.toString() === userId.toString();

    if (!isMember) {
      return sendResponse(res, 403, false, "Access denied");
    }

    const messages = await ChatMessage.find({ conversation: conversationId })
      .populate("sender", "name role avatar")
      .sort({ createdAt: 1 });

    return sendResponse(res, 200, true, "Messages retrieved", {
      conversation,
      messages,
    });
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   5. SEND CHAT MESSAGE (REST API FALLBACK)
====================================================== */
export const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text } = req.body;
    const senderId = req.user._id;

    if (!text || !text.trim()) {
      return sendResponse(res, 400, false, "Message text is required");
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return sendResponse(res, 404, false, "Conversation not found");
    }

    if (conversation.status !== "accepted") {
      return sendResponse(
        res,
        400,
        false,
        "Cannot send message until dealer accepts chat request"
      );
    }

    const isMember =
      req.user.role === "admin" ||
      conversation.buyer.toString() === senderId.toString() ||
      conversation.dealer.toString() === senderId.toString();

    if (!isMember) {
      return sendResponse(res, 403, false, "Access denied");
    }

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

    // Send Notification to recipient
    try {
      const recipientId =
        conversation.buyer.toString() === senderId.toString()
          ? conversation.dealer
          : conversation.buyer;

      const senderName = req.user.name || "User";
      await Notification.create({
        userId: recipientId,
        type: "new_message",
        title: `Message from ${senderName} 💬`,
        message: text.trim().length > 80 ? text.trim().slice(0, 80) + "..." : text.trim(),
        metadata: {
          conversationId: conversation._id,
          senderId: req.user._id,
          senderName: req.user.name,
          senderAvatar: req.user.avatar,
        },
      });
    } catch (notifErr) {
      console.error("Error creating message notification:", notifErr);
    }

    return sendResponse(res, 201, true, "Message sent", {
      message: populatedMsg,
      conversation,
    });
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};
