import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import {
  getPaymentMode,
  updatePaymentMode,
} from "../controllers/systemSetting.controller.js";

const router = express.Router();

router.get("/payment-mode", getPaymentMode);
router.put("/payment-mode", protect, authorize("admin"), updatePaymentMode);

export default router;
