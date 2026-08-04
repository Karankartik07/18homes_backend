import Property from "../models/property.model.js";
import Project from "../models/project.model.js";
import FeaturedAd from "../models/featuredAd.model.js";
import { getUserPlanDetails } from "../utils/subscriptionHelper.js";
import sendResponse from "../utils/apiResponse.js";

/**
 * Middleware to check subscription limits for various actions.
 * Supported actions: 'post_property', 'edit_property', 'create_project', 'featured_ad'
 */
export const checkPlanLimit = (action) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return sendResponse(res, 401, false, "User authentication required");
      }

      // Bypass checks for Admins
      if (user.role === "admin" || user.role === "super_admin") {
        return next();
      }

      const { rules } = await getUserPlanDetails(user._id, user.role);

      if (action === "post_property") {
        // Enforce role-based posting
        if (user.role === "user") {
          return sendResponse(
            res,
            403,
            false,
            "Normal users cannot post properties. Please switch your role to Owner, Dealer, or Builder."
          );
        }

        // Free plan limit: Max 1 property posted in the last 30 days
        if (rules.name === "Free") {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const monthlyPostedCount = await Property.countDocuments({
            owner: user._id,
            createdAt: { $gte: thirtyDaysAgo },
            isActive: true,
          });

          if (monthlyPostedCount >= rules.propertyLimit) {
            return sendResponse(
              res,
              403,
              false,
              "Monthly property limit reached. Free Plan allows posting only 1 property per month. Please upgrade your plan."
            );
          }
        } else {
          // Paid plans limit: Total active properties limit
          const totalActiveCount = await Property.countDocuments({
            owner: user._id,
            isActive: true,
          });

          if (totalActiveCount >= rules.propertyLimit) {
            return sendResponse(
              res,
              403,
              false,
              `Property limit reached. Your current plan allows a maximum of ${rules.propertyLimit} active listings. Please upgrade your plan.`
            );
          }
        }
      }

      else if (action === "edit_property") {
        const propertyId = req.params.id;
        const property = await Property.findById(propertyId);

        if (!property) {
          return sendResponse(res, 404, false, "Property listing not found");
        }

        // Verify ownership
        if (property.owner.toString() !== user._id.toString()) {
          return sendResponse(res, 403, false, "Not authorized to edit this property");
        }

        // If editDays is -1, editing is unlimited
        if (rules.editDays !== -1) {
          const hoursDiff = (Date.now() - property.createdAt.getTime()) / (1000 * 60 * 60);
          const limitHours = rules.editDays * 24;

          if (hoursDiff > limitHours) {
            return sendResponse(
              res,
              403,
              false,
              `Edit window expired. Your plan only allows editing properties within ${rules.editDays} day(s) of posting. Please upgrade to edit.`
            );
          }
        }
      }

      else if (action === "create_project") {
        // Enforce Dealer cannot post projects
        if (user.role === "dealer") {
          return sendResponse(res, 403, false, "Dealers are not authorized to post projects.");
        }

        if (rules.projectLimit <= 0) {
          return sendResponse(
            res,
            403,
            false,
            "Project posting is not included in your current plan. Please upgrade to list projects."
          );
        }

        const projectCount = await Project.countDocuments({
          builder: user._id,
          isActive: true,
        });

        if (projectCount >= rules.projectLimit) {
          return sendResponse(
            res,
            403,
            false,
            `Project limit reached. Your plan allows a maximum of ${rules.projectLimit} project listing(s). Please upgrade to post more.`
          );
        }
      }

      else if (action === "featured_ad") {
        if (!rules.featuredAd) {
          return sendResponse(
            res,
            403,
            false,
            "Featured Advertisement campaigns are only available on the Diamond Plan. Please upgrade."
          );
        }

        // Enforce only 1 active campaign at a time
        const activeAdCount = await FeaturedAd.countDocuments({
          dealer: user._id,
          status: "active",
          endDate: { $gte: new Date() },
        });

        if (activeAdCount >= 1) {
          return sendResponse(
            res,
            403,
            false,
            "You already have an active featured advertisement campaign. Only one campaign can be run at a time."
          );
        }
      }

      return next();
    } catch (error) {
      console.error("Subscription middleware error:", error);
      return sendResponse(res, 500, false, "Internal Server Error in subscription validation");
    }
  };
};
