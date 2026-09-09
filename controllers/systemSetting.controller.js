import SystemSetting from "../models/systemSetting.model.js";
import sendResponse from "../utils/apiResponse.js";

/**
 * Helper function for internal backend checks.
 * Returns true if payments are enabled, false if disabled (Free Mode).
 */
export const isPaymentSystemEnabled = async () => {
  try {
    const setting = await SystemSetting.findOne({ key: "isPaymentEnabled" });
    if (!setting) {
      return true; // Default to true if not explicitly set yet
    }
    return Boolean(setting.value);
  } catch (error) {
    console.error("Error checking payment system setting:", error);
    return true; // Safe fallback
  }
};

/**
 * Helper function for internal backend checks.
 * Returns true if admin approval is required, false if auto-approval mode is active.
 */
export const isAdminApprovalRequired = async () => {
  try {
    const setting = await SystemSetting.findOne({ key: "isApprovalRequired" });
    if (!setting) {
      return true; // Default to true if not explicitly set yet
    }
    return Boolean(setting.value);
  } catch (error) {
    console.error("Error checking admin approval setting:", error);
    return true; // Safe fallback
  }
};

/**
 * GET /api/settings/payment-mode & GET /api/settings/all
 * Retrieves current system settings (isPaymentEnabled & isApprovalRequired).
 */
export const getPaymentMode = async (req, res) => {
  try {
    let paymentSetting = await SystemSetting.findOne({ key: "isPaymentEnabled" });
    if (!paymentSetting) {
      paymentSetting = await SystemSetting.create({
        key: "isPaymentEnabled",
        value: true,
        description: "Global toggle for payment gateway (Razorpay) and membership paywalls",
      });
    }

    let approvalSetting = await SystemSetting.findOne({ key: "isApprovalRequired" });
    if (!approvalSetting) {
      approvalSetting = await SystemSetting.create({
        key: "isApprovalRequired",
        value: true,
        description: "Global toggle for Admin approval requirement on Dealer & Builder roles",
      });
    }

    return sendResponse(res, 200, true, "System settings retrieved", {
      isPaymentEnabled: Boolean(paymentSetting.value),
      isApprovalRequired: Boolean(approvalSetting.value),
      updatedAt: approvalSetting.updatedAt || paymentSetting.updatedAt,
    });
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/**
 * PUT /api/settings/payment-mode
 * Admin endpoint to toggle payment system mode (ON / OFF).
 */
export const updatePaymentMode = async (req, res) => {
  try {
    const { isPaymentEnabled, isApprovalRequired, key, value } = req.body;

    // Handle key-value toggle or explicit boolean props
    if (key && typeof value === "boolean") {
      const setting = await SystemSetting.findOneAndUpdate(
        { key },
        { value },
        { new: true, upsert: true }
      );
      return sendResponse(res, 200, true, `Setting '${key}' updated`, {
        key: setting.key,
        value: Boolean(setting.value),
        updatedAt: setting.updatedAt,
      });
    }

    if (typeof isPaymentEnabled === "boolean") {
      await SystemSetting.findOneAndUpdate(
        { key: "isPaymentEnabled" },
        {
          value: isPaymentEnabled,
          description: "Global toggle for payment gateway (Razorpay) and membership paywalls",
        },
        { new: true, upsert: true }
      );
    }

    if (typeof isApprovalRequired === "boolean") {
      await SystemSetting.findOneAndUpdate(
        { key: "isApprovalRequired" },
        {
          value: isApprovalRequired,
          description: "Global toggle for Admin approval requirement on Dealer & Builder roles",
        },
        { new: true, upsert: true }
      );
    }

    // Fetch fresh updated states
    const payments = await isPaymentSystemEnabled();
    const approvals = await isAdminApprovalRequired();

    return sendResponse(res, 200, true, "System settings updated successfully", {
      isPaymentEnabled: payments,
      isApprovalRequired: approvals,
      updatedAt: new Date(),
    });
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};
