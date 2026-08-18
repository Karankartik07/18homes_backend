import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  toggleBlockUser,
  getPendingApprovals,
  approveUser,
  rejectUser,
} from "../controllers/user.controller.js";
import { assignPlanByAdmin } from "../controllers/subscription.controller.js";

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/", getAllUsers);
router.get("/pending-approvals", getPendingApprovals);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);
router.patch("/:id/block", toggleBlockUser);
router.patch("/:id/approve", approveUser);
router.patch("/:id/reject", rejectUser);
router.post("/:id/assign-plan", assignPlanByAdmin);

export default router;