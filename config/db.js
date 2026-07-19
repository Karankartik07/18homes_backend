import mongoose from "mongoose";
import BoostPlan from "../models/boostPlan.model.js";
import Property from "../models/property.model.js";
import Payment from "../models/payment.model.js";

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

const migrateBoostFields = async () => {
  try {
    const properties = await Property.find({
      boostExpiresAt: { $exists: true, $ne: null },
      boostType: { $exists: false }
    });
    if (properties.length > 0) {
      console.log(`🧹 Migrating ${properties.length} boosted properties...`);
      for (const prop of properties) {
        const payment = await Payment.findOne({
          propertyId: prop._id,
          status: "completed",
        }).sort({ createdAt: -1 });

        if (payment) {
          prop.boostType = payment.amount === 0 ? "admin" : "user";
          prop.boostRevenue = payment.amount;
        } else {
          prop.boostType = "admin";
          prop.boostRevenue = 0;
        }
        await prop.save();
      }
      console.log("✅ Boost fields migration completed");
    }
  } catch (error) {
    console.error("❌ Boost fields migration failed:", error.message);
  }
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
    await seedBoostPlans();
    await migrateBoostFields();
  } catch (error) {
    console.error("❌ DB Connection Failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
