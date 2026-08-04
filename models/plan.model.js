import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["dealer", "builder"],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    duration: {
      type: Number,
      default: 30, // in days
    },
    propertyLimit: {
      type: Number,
      required: true,
    },
    editDays: {
      type: Number,
      required: true, // -1 means unlimited
    },
    boostDiscount: {
      type: Number,
      default: 0, // discount percentage
    },
    analyticsAccess: {
      type: Number,
      default: 1, // number of tabs allowed (e.g., 1, 3, 5, 7)
    },
    leadLimit: {
      type: Number,
      required: true, // -1 means unlimited
    },
    projectLimit: {
      type: Number,
      default: 0,
    },
    featuredAd: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

planSchema.index({ role: 1, name: 1 }, { unique: true });

export default mongoose.model("Plan", planSchema);
