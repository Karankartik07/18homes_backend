// ========================= SAFE SEED APIS (DELETION DISABLED) =========================
import express from "express";
import User from "../models/user.model.js";
import Property from "../models/property.model.js";
import Contact from "../models/contact.model.js";

const router = express.Router();

// Middleware to block seed routes in production / default mode
const checkSeedAllowed = (req, res, next) => {
  if (process.env.ENABLE_SEED_API !== "true") {
    return res.status(403).json({
      success: false,
      message: "Seed API is disabled for safety. To enable, set ENABLE_SEED_API=true in .env",
    });
  }
  next();
};

router.use(checkSeedAllowed);

// SAFE SEED: NEVER CALL DELETE MANY!
router.post("/properties", async (req, res) => {
  return res.status(400).json({
    success: false,
    message: "Destructive seeding disabled to protect live property data.",
  });
});

router.post("/users", async (req, res) => {
  return res.status(400).json({
    success: false,
    message: "Destructive seeding disabled to protect user data.",
  });
});

router.post("/all", async (req, res) => {
  return res.status(400).json({
    success: false,
    message: "Destructive bulk wipe and seed is permanently disabled for database safety.",
  });
});

export default router;
