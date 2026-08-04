import UserSubscription from "../models/userSubscription.model.js";
import Plan from "../models/plan.model.js";

/**
 * Gets the active subscription for a user. If expired, updates its status and returns the Free Plan.
 * If no subscription exists, returns the default Free Plan configuration for the user's role.
 * 
 * @param {string} userId - User ID
 * @param {string} userRole - User's role (owner, dealer, builder)
 * @returns {Promise<Object>} The active plan rules and subscription details.
 */
export const getUserPlanDetails = async (userId, userRole) => {
  // Owner only has Free Plan rules
  const role = ["dealer", "builder"].includes(userRole) ? userRole : "owner";

  // Check for active subscription in DB
  let subscription = await UserSubscription.findOne({
    userId,
    status: "active",
  });

  const now = new Date();

  // If subscription exists, verify expiry
  if (subscription) {
    if (subscription.expiryDate <= now) {
      // Dynamic Expiry update
      subscription.status = "expired";
      await subscription.save();
      subscription = null;
    }
  }

  // If they have a valid active subscription, retrieve its details from Plan database
  if (subscription) {
    const planRules = await Plan.findById(subscription.planId);
    if (planRules && planRules.active) {
      return {
        hasActiveSubscription: true,
        subscription,
        rules: planRules.toObject(),
      };
    }
  }

  // Fallback / default Free Plan details
  // Look up Free plan for their role in the Plan collection first to stay synced
  let freePlanRules = null;
  try {
    freePlanRules = await Plan.findOne({ role: role === "owner" ? "dealer" : role, name: "Free", active: true });
  } catch (err) {
    console.error("Failed to query Free plan from DB, using fallback", err);
  }

  if (!freePlanRules) {
    freePlanRules = {
      role: role === "owner" ? "dealer" : role,
      name: "Free",
      price: 0,
      duration: 30,
      propertyLimit: 1,
      editDays: 1,
      boostDiscount: 0,
      analyticsAccess: 1,
      leadLimit: -1,
      projectLimit: 0,
      featuredAd: false,
    };
  } else {
    freePlanRules = freePlanRules.toObject();
  }

  // If role is owner, enforce Free Plan limits explicitly
  if (role === "owner") {
    freePlanRules.role = "owner";
    freePlanRules.projectLimit = 0;
    freePlanRules.featuredAd = false;
  }

  return {
    hasActiveSubscription: false,
    subscription: null,
    rules: freePlanRules,
  };
};
