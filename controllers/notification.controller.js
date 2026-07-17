import Property from "../models/property.model.js";
import Notification from "../models/notification.model.js";
import sendResponse from "../utils/apiResponse.js";

// Get all notifications for user, checks for expiring boosted plans dynamically
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Dynamic Check for expiring boost plans (expires in <= 24 hours)
    const now = new Date();
    const targetTime24h = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Find active boosted properties owned by user that expire within next 24h
    const expiringProperties = await Property.find({
      owner: userId,
      isBoosted: true,
      boostExpiresAt: { $gt: now, $lte: targetTime24h },
    });

    for (const property of expiringProperties) {
      const timeDiff = property.boostExpiresAt.getTime() - now.getTime();
      const hoursLeft = Math.max(0, Math.round(timeDiff / (1000 * 60 * 60)));

      if (timeDiff <= 1 * 60 * 60 * 1000) {
        // <= 1 hour remaining
        // Check if 1h warning exists
        const exists1h = await Notification.findOne({
          userId,
          type: "boost_expiring",
          "metadata.propertyId": property._id,
          "metadata.boostExpiresAt": property.boostExpiresAt,
          "metadata.threshold": "1h",
        });

        if (!exists1h) {
          await Notification.create({
            userId,
            type: "boost_expiring",
            title: "Boost Plan Expiring in 1 Hour! ⚠️",
            message: `Your boost plan for property "${property.title}" will expire in 1 hour. Boost it again to keep it at the top!`,
            metadata: {
              propertyId: property._id,
              boostExpiresAt: property.boostExpiresAt,
              threshold: "1h",
            },
          });
        }
      } else {
        // Between 1 hour and 24 hours remaining
        // Check if 24h warning exists (also match old warnings where threshold might be undefined)
        const exists24h = await Notification.findOne({
          userId,
          type: "boost_expiring",
          "metadata.propertyId": property._id,
          "metadata.boostExpiresAt": property.boostExpiresAt,
          $or: [
            { "metadata.threshold": "24h" },
            { "metadata.threshold": { $exists: false } }
          ]
        });

        if (!exists24h) {
          await Notification.create({
            userId,
            type: "boost_expiring",
            title: "Boost Plan Expiring Soon! ⚠️",
            message: `Your boost plan for property "${property.title}" will expire in ${hoursLeft} hours. Boost it again to keep it at the top!`,
            metadata: {
              propertyId: property._id,
              boostExpiresAt: property.boostExpiresAt,
              threshold: "24h",
            },
          });
        }
      }
    }

    // 2. Dynamic Check for expired boost plans
    const expiredProperties = await Property.find({
      owner: userId,
      boostExpiresAt: { $lte: now },
    });

    for (const property of expiredProperties) {
      const existsExpired = await Notification.findOne({
        userId,
        type: "boost_expiring",
        "metadata.propertyId": property._id,
        "metadata.boostExpiresAt": property.boostExpiresAt,
        "metadata.threshold": "expired",
      });

      if (!existsExpired) {
        await Notification.create({
          userId,
          type: "boost_expiring",
          title: "Boost Plan Expired ❌",
          message: `Your boost plan for property "${property.title}" has expired. Boost it again to bring it back to the top!`,
          metadata: {
            propertyId: property._id,
            boostExpiresAt: property.boostExpiresAt,
            threshold: "expired",
          },
        });
      }
    }

    // 2. Fetch all notifications
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });

    return sendResponse(res, 200, true, "Notifications retrieved successfully", notifications);
  } catch (error) {
    console.error("Error in getNotifications:", error);
    return sendResponse(res, 500, false, "Failed to retrieve notifications");
  }
};

// Mark a single notification as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return sendResponse(res, 404, false, "Notification not found");
    }

    return sendResponse(res, 200, true, "Notification marked as read", notification);
  } catch (error) {
    console.error("Error in markAsRead:", error);
    return sendResponse(res, 500, false, "Failed to mark notification as read");
  }
};

// Mark all notifications as read for user
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    await Notification.updateMany({ userId, read: false }, { read: true });

    return sendResponse(res, 200, true, "All notifications marked as read");
  } catch (error) {
    console.error("Error in markAllAsRead:", error);
    return sendResponse(res, 500, false, "Failed to mark all notifications as read");
  }
};

// Delete a single notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndDelete({ _id: id, userId });

    if (!notification) {
      return sendResponse(res, 404, false, "Notification not found");
    }

    return sendResponse(res, 200, true, "Notification deleted successfully");
  } catch (error) {
    console.error("Error in deleteNotification:", error);
    return sendResponse(res, 500, false, "Failed to delete notification");
  }
};

// Clear all notifications for user
export const clearAllNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    await Notification.deleteMany({ userId });

    return sendResponse(res, 200, true, "All notifications cleared successfully");
  } catch (error) {
    console.error("Error in clearAllNotifications:", error);
    return sendResponse(res, 500, false, "Failed to clear notifications");
  }
};
