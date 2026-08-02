import express from "express";
import {
  createFeaturedAd,
  getMyFeaturedAds,
  getFeaturedAgentsByLocality,
  getAllFeaturedAdsAdmin,
  updateFeaturedAdStatus,
  deleteFeaturedAd,
} from "../controllers/featuredAd.controller.js";
import { protect, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public route to fetch locality featured agents
router.get("/locality", getFeaturedAgentsByLocality);

// Protected routes (Dealer, Builder, Admin)
router.use(protect);

router.post("/", authorize("dealer", "builder", "admin"), createFeaturedAd);
router.get("/my", authorize("dealer", "builder", "admin"), getMyFeaturedAds);

// Admin routes
router.get("/admin/all", authorize("admin"), getAllFeaturedAdsAdmin);
router.patch("/:id/status", authorize("admin", "dealer", "builder"), updateFeaturedAdStatus);
router.delete("/:id", authorize("admin", "dealer", "builder"), deleteFeaturedAd);

export default router;
