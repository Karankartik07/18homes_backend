import User from "../models/user.model.js";
import Plan from "../models/plan.model.js";
import UserSubscription from "../models/userSubscription.model.js";
import PaymentHistory from "../models/paymentHistory.model.js";
import Property from "../models/property.model.js";
import Project from "../models/project.model.js";
import FeaturedAd from "../models/featuredAd.model.js";
import Notification from "../models/notification.model.js";
import sendResponse from "../utils/apiResponse.js";
import { getUserPlanDetails } from "../utils/subscriptionHelper.js";
import Razorpay from "razorpay";
import crypto from "crypto";

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_TLOcW73PhlSHBW",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "1nwIrTcZVxGzBfm7OLeWWKvT",
});

/* ======================================================
   1. GET ALL MEMBERSHIP PLANS
   ====================================================== */
export const getPlans = async (req, res) => {
  try {
    const { role } = req.query;
    const filter = { active: true };
    if (role && ["dealer", "builder"].includes(role)) {
      filter.role = role;
    }
    const plans = await Plan.find(filter).sort({ price: 1 });
    return sendResponse(res, 200, true, "Plans fetched successfully", plans);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   2. GET CURRENT SUBSCRIPTION & USAGE STATS
   ====================================================== */
export const getCurrentSubscription = async (req, res) => {
  try {
    const user = req.user;
    const planDetails = await getUserPlanDetails(user._id, user.role);

    // Calculate usage statistics to show limits gauges in frontend dashboard
    const activePropertiesCount = await Property.countDocuments({
      owner: user._id,
      isActive: true,
    });

    const activeProjectsCount = await Project.countDocuments({
      builder: user._id,
      isActive: true,
    });

    const activeAdsCount = await FeaturedAd.countDocuments({
      dealer: user._id,
      status: "active",
      endDate: { $gte: new Date() },
    });

    let remainingDays = 0;
    if (planDetails.subscription) {
      const expiry = new Date(planDetails.subscription.expiryDate);
      const diffMs = expiry.getTime() - Date.now();
      remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    const payload = {
      planName: planDetails.rules.name,
      role: planDetails.rules.role,
      rules: planDetails.rules,
      subscription: planDetails.subscription,
      remainingDays,
      usage: {
        propertiesCount: activePropertiesCount,
        projectsCount: activeProjectsCount,
        featuredAdsCount: activeAdsCount,
      },
    };

    return sendResponse(res, 200, true, "Current subscription fetched successfully", payload);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   3. GET USER PAYMENT TRANSACTION HISTORY
   ====================================================== */
export const getPaymentHistory = async (req, res) => {
  try {
    const history = await PaymentHistory.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return sendResponse(res, 200, true, "Payment history fetched successfully", history);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   4. CREATE RAZORPAY ORDER FOR MEMBERSHIP
   ====================================================== */
export const createSubscriptionOrder = async (req, res) => {
  try {
    const { planId } = req.body;
    const user = req.user;

    if (user.role === "admin" || user.role === "super_admin") {
      return sendResponse(res, 400, false, "Admins have full unlimited access across the platform and do not require a subscription plan.");
    }

    if (!["dealer", "builder"].includes(user.role)) {
      return sendResponse(res, 400, false, "Only Dealers and Builders are allowed to buy memberships.");
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.active) {
      return sendResponse(res, 404, false, "Membership plan not found or inactive.");
    }

    // Role verification: ensure user role matches plan role
    if (plan.role !== user.role) {
      return sendResponse(res, 400, false, `Cannot purchase a ${plan.role} plan as a ${user.role}.`);
    }

    // If it's a Free Plan purchase, we directly activate it (price is 0)
    if (plan.price === 0) {
      return sendResponse(res, 400, false, "Free plan cannot be purchased. It is active by default.");
    }

    const options = {
      amount: plan.price * 100, // paise
      currency: "INR",
      receipt: `sub_${user._id.toString().slice(-6)}_${Date.now()}`,
    };

    const order = await razorpayInstance.orders.create(options);

    // Save pending transaction record
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    await PaymentHistory.create({
      userId: user._id,
      plan: plan.name,
      amount: plan.price,
      paymentStatus: "pending",
      gateway: "razorpay",
      orderId: order.id,
      invoiceNumber,
    });

    return sendResponse(res, 201, true, "Razorpay order created successfully", {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayInstance.key_id,
      planName: plan.name,
    });
  } catch (error) {
    console.error("Error creating subscription order:", error);
    return sendResponse(res, 500, false, error.message || "Failed to create payment order");
  }
};

/* ======================================================
   5. VERIFY PAYMENT & ACTIVATE MEMBERSHIP
   ====================================================== */
export const verifySubscriptionPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
    } = req.body;
    const user = req.user;

    // Verify razorpay signature
    const shasum = crypto.createHmac("sha256", razorpayInstance.key_secret);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest("hex");

    if (digest !== razorpay_signature) {
      await PaymentHistory.findOneAndUpdate(
        { orderId: razorpay_order_id },
        { paymentStatus: "failed", paymentId: razorpay_payment_id }
      );
      return sendResponse(res, 400, false, "Payment signature verification failed. Unauthorized transaction.");
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return sendResponse(res, 404, false, "Selected plan rules no longer exist.");
    }

    // Resolve transaction log
    const paymentRecord = await PaymentHistory.findOne({ orderId: razorpay_order_id });
    const invoiceNumber = paymentRecord?.invoiceNumber || `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    if (paymentRecord) {
      paymentRecord.paymentStatus = "completed";
      paymentRecord.paymentId = razorpay_payment_id;
      paymentRecord.invoiceNumber = invoiceNumber;
      await paymentRecord.save();
    } else {
      // Create record if somehow missing
      await PaymentHistory.create({
        userId: user._id,
        plan: plan.name,
        amount: plan.price,
        paymentStatus: "completed",
        gateway: "razorpay",
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        invoiceNumber,
      });
    }

    // Calculate billing dates
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + plan.duration);

    // Cancel / disable any other existing active memberships
    await UserSubscription.updateMany(
      { userId: user._id, status: "active" },
      { $set: { status: "cancelled" } }
    );

    // Create / Save new active subscription
    const subscription = await UserSubscription.create({
      userId: user._id,
      role: user.role,
      planId: plan._id,
      planName: plan.name,
      startDate,
      expiryDate,
      status: "active",
      paymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      transactionId: razorpay_payment_id,
      amount: plan.price,
      invoiceNumber,
      autoRenew: false,
    });

    // Create notification alert
    try {
      await Notification.create({
        userId: user._id,
        type: "payment_success",
        title: "Membership Activated! 👑",
        message: `Congratulations! Your "${plan.name}" membership plan has been successfully activated. Expiry date: ${expiryDate.toLocaleDateString("en-IN")}.`,
        metadata: {
          subscriptionId: subscription._id,
          invoiceNumber,
        },
      });
    } catch (notifErr) {
      console.error("Failed to post notification upon upgrade:", notifErr);
    }

    return sendResponse(res, 200, true, "Membership plan upgraded successfully!", {
      subscription,
      planName: plan.name,
    });
  } catch (error) {
    console.error("Error verifying subscription payment:", error);
    return sendResponse(res, 500, false, error.message || "Failed to process payment verification");
  }
};

/* ======================================================
   6. CANCEL ACTIVE MEMBERSHIP AUTO RENEWAL
   ====================================================== */
export const cancelSubscription = async (req, res) => {
  try {
    const subscription = await UserSubscription.findOneAndUpdate(
      { userId: req.user._id, status: "active" },
      { autoRenew: false },
      { new: true }
    );

    if (!subscription) {
      return sendResponse(res, 404, false, "No active subscription found to cancel auto-renewal.");
    }

    return sendResponse(res, 200, true, "Auto-renewal disabled successfully.", subscription);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   7. RAZORPAY WEBHOOK HANDLER
   ====================================================== */
export const razorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "supersecretwebhook";
    const signature = req.headers["x-razorpay-signature"];

    const shasum = crypto.createHmac("sha256", webhookSecret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest("hex");

    if (digest !== signature) {
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    const event = req.body.event;
    console.log("⚓ Razorpay Webhook Event Received:", event);

    if (event === "payment.failed") {
      const paymentEntity = req.body.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      await PaymentHistory.findOneAndUpdate(
        { orderId },
        { paymentStatus: "failed", paymentId: paymentEntity.id }
      );
    }

    return res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ======================================================
   8. ADMIN ASSIGN PLAN DIRECTLY TO USER
   ====================================================== */
export const assignPlanByAdmin = async (req, res) => {
  try {
    const { id: userId } = req.params;
    const { planId, customDurationDays } = req.body;
    const adminUser = req.user;

    if (!userId) {
      return sendResponse(res, 400, false, "Target user ID is required");
    }

    if (!planId) {
      return sendResponse(res, 400, false, "Plan ID is required");
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return sendResponse(res, 404, false, "User not found");
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.active) {
      return sendResponse(res, 404, false, "Selected membership plan not found or inactive");
    }

    // Determine plan duration in days
    const durationDays = Number(customDurationDays) > 0 ? Number(customDurationDays) : (plan.duration || 30);

    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + durationDays);

    // Cancel / disable any existing active membership for this user
    await UserSubscription.updateMany(
      { userId: targetUser._id, status: "active" },
      { $set: { status: "cancelled" } }
    );

    const invoiceNumber = `INV-ADM-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const razorpayOrderId = `ADM-ORDER-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create new Admin-Assigned subscription
    const subscription = await UserSubscription.create({
      userId: targetUser._id,
      role: targetUser.role === "builder" ? "builder" : "dealer",
      planId: plan._id,
      planName: plan.name,
      startDate,
      expiryDate,
      status: "active",
      amount: plan.price || 0,
      invoiceNumber,
      razorpayOrderId,
      assignedByAdmin: true,
      assignedBy: adminUser?._id,
      autoRenew: false,
    });

    // Create notification alert for the target user
    try {
      await Notification.create({
        userId: targetUser._id,
        type: "payment_success",
        title: "Admin Granted Plan! 🛡️👑",
        message: `Admin has assigned you the "${plan.name}" plan! Expiry date: ${expiryDate.toLocaleDateString("en-IN")}.`,
        metadata: {
          subscriptionId: subscription._id,
          invoiceNumber,
        },
      });
    } catch (notifErr) {
      console.error("Failed to post notification for admin assign:", notifErr);
    }

    return sendResponse(
      res,
      200,
      true,
      `Plan "${plan.name}" successfully assigned to user ${targetUser.name || targetUser.email}!`,
      subscription
    );
  } catch (error) {
    console.error("Error assigning plan by admin:", error);
    return sendResponse(res, 500, false, error.message || "Failed to assign plan");
  }
};

