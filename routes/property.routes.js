import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
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
} from "../controllers/property.controller.js";

const router = express.Router();

/* ======================= ADMIN ROUTES (TOP) ======================= */
router.get(
  "/admin/all",
  protect,
  authorize("admin"),
  getAllPropertiesAdmin
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

/* ======================= USER ROUTES ======================= */
router.post("/", protect, createProperty);
router.get("/my/properties", protect, getMyProperties);
router.get("/my/saved", protect, getSavedProperties);
router.post("/:id/save", protect, toggleSaveProperty);
router.put("/:id", protect, updateProperty);
router.delete("/:id", protect, deleteProperty);

/* ======================= PUBLIC ROUTES (LAST) ======================= */
router.get("/", getAllProperties);
router.get("/:id", getPropertyById); // ⚠️ ALWAYS LAST

export default router;
