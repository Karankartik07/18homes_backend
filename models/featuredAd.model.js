import mongoose from "mongoose";

const featuredAdSchema = new mongoose.Schema(
  {
    dealer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    locality: {
      type: String,
      trim: true,
      default: "",
    },
    tagline: {
      type: String,
      trim: true,
      default: "Top Area Specialist & Verified Dealer",
    },
    adPackage: {
      type: String,
      enum: ["starter_7_days", "pro_30_days", "premium_90_days"],
      default: "pro_30_days",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "pending", "expired", "rejected"],
      default: "active",
    },
    clickCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

featuredAdSchema.index({ city: 1, locality: 1, status: 1 });
featuredAdSchema.index({ dealer: 1, createdAt: -1 });

export default mongoose.model("FeaturedAd", featuredAdSchema);
