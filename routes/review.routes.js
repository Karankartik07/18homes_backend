import express from "express";
import { protect, optionalProtect } from "../middleware/auth.middleware.js";
import {
  addOrUpdateReview,
  getPropertyReviews,
  deleteReview,
} from "../controllers/review.controller.js";

const router = express.Router();

router.post("/", protect, addOrUpdateReview);
router.get("/property/:propertyId", optionalProtect, getPropertyReviews);
router.delete("/:reviewId", protect, deleteReview);

export default router;
