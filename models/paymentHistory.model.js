import mongoose from "mongoose";

const paymentHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
      index: true,
    },
    gateway: {
      type: String,
      default: "razorpay",
    },
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    paymentId: {
      type: String,
    },
    invoiceNumber: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("PaymentHistory", paymentHistorySchema);
