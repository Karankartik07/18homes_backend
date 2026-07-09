import mongoose from "mongoose";
import BoostPlan from "../models/boostPlan.model.js";

const seedBoostPlans = async () => {
  try {
    const plansCount = await BoostPlan.countDocuments();
    if (plansCount === 0) {
      const defaultPlans = [
        { key: "7days", name: "7 Days Boost", durationDays: 7, price: 19 },
        { key: "15days", name: "15 Days Boost", durationDays: 15, price: 49 },
        { key: "30days", name: "30 Days Boost", durationDays: 30, price: 99 },
      ];
      await BoostPlan.insertMany(defaultPlans);
      console.log("🌱 Default Boost Plans Seeded Successfully");
    }
  } catch (error) {
    console.error("❌ Seeding Boost Plans Failed:", error.message);
  }
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
    await seedBoostPlans();
  } catch (error) {
    console.error("❌ DB Connection Failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
