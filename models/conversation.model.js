import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dealer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    lastMessage: {
      type: String,
      default: "",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ buyer: 1, dealer: 1, property: 1 }, { unique: true });
conversationSchema.index({ dealer: 1, status: 1 });
conversationSchema.index({ buyer: 1 });

export default mongoose.model("Conversation", conversationSchema);
