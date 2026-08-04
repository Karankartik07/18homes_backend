import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  getPlans,
  getCurrentSubscription,
  getPaymentHistory,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  cancelSubscription,
  razorpayWebhook,
} from "../controllers/subscription.controller.js";

const router = express.Router();

// Public routes
router.get("/plans", getPlans);

// Webhook route (needs to be public for Razorpay webhook callbacks)
router.post("/webhook", razorpayWebhook);

// Protected routes (requires user login)
router.get("/current", protect, getCurrentSubscription);
router.get("/history", protect, getPaymentHistory);
router.post("/create-order", protect, createSubscriptionOrder);
router.post("/verify-payment", protect, verifySubscriptionPayment);
router.post("/cancel", protect, cancelSubscription);

export default router;
