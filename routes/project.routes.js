import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { checkPlanLimit } from "../middleware/subscription.middleware.js";
import {
  createProject,
  getProjects,
  getMyProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from "../controllers/project.controller.js";

const router = express.Router();

router.get("/", getProjects);
router.get("/my", protect, getMyProjects);
router.get("/:id", getProjectById);

router.post("/", protect, checkPlanLimit("create_project"), createProject);
router.put("/:id", protect, updateProject);
router.delete("/:id", protect, deleteProject);

export default router;
