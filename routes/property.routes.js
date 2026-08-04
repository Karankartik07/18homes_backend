import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { checkPlanLimit } from "../middleware/subscription.middleware.js";
import {
  createProperty,
  getAllProperties,
  getPropertyById,
  getMyProperties,
  updateProperty,
  deleteProperty,
  deletePropertyAdmin,
  toggleSaveProperty,
  getSavedProperties,
  getAllPropertiesAdmin,
  flagProperty,
  incrementPropertyViews,
  incrementPropertyAdminViews,
  incrementPropertyContactClicks,
  getBoostPlans,
  updateBoostPlanPrice,
  createBoostOrder,
  verifyBoostPayment,
  getBoostedPropertiesAdmin,
  addToHistoryProperty,
  getHistoryProperties,
  deleteFromHistoryProperty,
  clearHistoryProperties,
  trackAnalyticsEvent,
  getBuilderAnalytics,
} from "../controllers/property.controller.js";

const router = express.Router();

/* ======================= ADMIN ROUTES (TOP) ======================= */
router.get(
  "/admin/all",
  protect,
  authorize("admin"),
  getAllPropertiesAdmin
);

router.get(
  "/admin/boosted",
  protect,
  authorize("admin"),
  getBoostedPropertiesAdmin
);

router.put(
  "/admin/boost/plans/:planKey",
  protect,
  authorize("admin"),
  updateBoostPlanPrice
);

router.patch(
  "/admin/:id/flag",
  protect,
  authorize("admin"),
  flagProperty
);

router.delete(
  "/admin/:id",
  protect,
  authorize("admin"),
  deletePropertyAdmin
);

/* ======================= ANALYTICS ROUTES ======================= */
router.post("/analytics/track", trackAnalyticsEvent);
router.get("/analytics/builder", protect, getBuilderAnalytics);

/* ======================= USER ROUTES ======================= */
router.get("/boost/plans", getBoostPlans);
router.post("/", protect, checkPlanLimit("post_property"), createProperty);
router.get("/my/properties", protect, getMyProperties);
router.get("/my/saved", protect, getSavedProperties);
router.post("/:id/save", protect, toggleSaveProperty);
router.get("/my/history", protect, getHistoryProperties);
router.post("/:id/history", protect, addToHistoryProperty);
router.delete("/my/history/clear", protect, clearHistoryProperties);
router.delete("/:id/history", protect, deleteFromHistoryProperty);
router.put("/:id", protect, checkPlanLimit("edit_property"), updateProperty);
router.delete("/:id", protect, deleteProperty);
router.post("/:id/boost/order", protect, createBoostOrder);
router.post("/:id/boost/verify", protect, verifyBoostPayment);

/* ======================= PUBLIC ROUTES (LAST) ======================= */
router.post("/:id/click", incrementPropertyViews);
router.post("/:id/admin-click", incrementPropertyAdminViews);
router.post("/:id/contact-click", incrementPropertyContactClicks);
router.get("/", getAllProperties);
router.get("/:id", getPropertyById); // ⚠️ ALWAYS LAST

export default router;
