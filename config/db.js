import mongoose from "mongoose";
import BoostPlan from "../models/boostPlan.model.js";
import Property from "../models/property.model.js";
import Payment from "../models/payment.model.js";
import Plan from "../models/plan.model.js";

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

const seedMembershipPlans = async () => {
  try {
    const plansCount = await Plan.countDocuments();
    if (plansCount === 0) {
      const defaultPlans = [
        // Dealers
        {
          role: "dealer",
          name: "Free",
          price: 0,
          duration: 30,
          propertyLimit: 1,
          editDays: 1, // 24 hours
          boostDiscount: 0,
          analyticsAccess: 1, // 1 tab (Total Visitors)
          leadLimit: -1, // Basic lead access
          projectLimit: 0,
          featuredAd: false,
        },
        {
          role: "dealer",
          name: "Gold",
          price: 999,
          duration: 30,
          propertyLimit: 3,
          editDays: 2, // 2 days
          boostDiscount: 5,
          analyticsAccess: 3, // 3 tabs
          leadLimit: 7,
          projectLimit: 0,
          featuredAd: false,
        },
        {
          role: "dealer",
          name: "Platinum",
          price: 1999,
          duration: 30,
          propertyLimit: 5,
          editDays: 4, // 4 days
          boostDiscount: 15,
          analyticsAccess: 5, // 5 tabs
          leadLimit: 15,
          projectLimit: 0,
          featuredAd: false,
        },
        {
          role: "dealer",
          name: "Diamond",
          price: 4999,
          duration: 30,
          propertyLimit: 20,
          editDays: -1, // Unlimited
          boostDiscount: 30,
          analyticsAccess: 7, // 7 tabs (full)
          leadLimit: -1, // Unlimited
          projectLimit: 0,
          featuredAd: true,
        },
        // Builders
        {
          role: "builder",
          name: "Free",
          price: 0,
          duration: 30,
          propertyLimit: 1,
          editDays: 1, // 24 hours
          boostDiscount: 0,
          analyticsAccess: 1,
          leadLimit: -1,
          projectLimit: 0,
          featuredAd: false,
        },
        {
          role: "builder",
          name: "Gold",
          price: 2999,
          duration: 30,
          propertyLimit: 5,
          editDays: 3, // 3 days
          boostDiscount: 10,
          analyticsAccess: 3,
          leadLimit: 10,
          projectLimit: 1,
          featuredAd: false,
        },
        {
          role: "builder",
          name: "Platinum",
          price: 5999,
          duration: 30,
          propertyLimit: 7,
          editDays: 5, // 5 days
          boostDiscount: 20,
          analyticsAccess: 5,
          leadLimit: 20,
          projectLimit: 3,
          featuredAd: false,
        },
        {
          role: "builder",
          name: "Diamond",
          price: 14999,
          duration: 30,
          propertyLimit: 20,
          editDays: -1, // Unlimited
          boostDiscount: 30,
          analyticsAccess: 7,
          leadLimit: -1, // Unlimited
          projectLimit: 5,
          featuredAd: true,
        },
      ];
      await Plan.insertMany(defaultPlans);
      console.log("🌱 Default Membership Plans Seeded Successfully");
    }
  } catch (error) {
    console.error("❌ Seeding Membership Plans Failed:", error.message);
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
    await seedMembershipPlans();
    await migrateBoostFields();
  } catch (error) {
    console.error("❌ DB Connection Failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
