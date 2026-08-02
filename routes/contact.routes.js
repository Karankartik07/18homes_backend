// ========================= ROUTES =========================

// contact.routes.js
import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  createContact,
  getMyContacts,
  getContactById,
  deleteContact,
  updateContactStatus,
} from "../controllers/contact.controller.js";

const router = express.Router();

router.post("/", protect, createContact);
router.get("/", protect, getMyContacts);
router.get("/:id", protect, getContactById);
router.patch("/:id/status", protect, updateContactStatus);
router.delete("/:id", protect, deleteContact);

export default router;
