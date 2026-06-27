// ========================= property.model.js =========================
import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
    },

    purpose: {
      type: String,
      enum: ["sell", "rent"],
      required: true,
    },

    propertyType: {
      type: String,
      enum: ["flat", "house", "plot", "shop", "office", "apartment", "commercial"],
      required: true,
    },

    commercialType: {
      type: String,
      enum: ["hotel", "hospital", "school", "pg", "lease land", "commercial land", "other"],
    },

    commercialTypeCustom: {
      type: String,
      trim: true,
    },

    isHighRise: {
      type: Boolean,
      default: false,
    },

    floorNo: {
      type: String,
      trim: true,
    },

    totalFloors: {
      type: String,
      trim: true,
    },

    // 🔥 DISPLAY PRICE (ANY FORMAT)
    priceText: {
      type: String,
      required: true,
      trim: true,
    },

    // 🔥 FILTER PRICE (NUMBER ONLY)
    priceValue: {
      type: Number,
      index: true,
    },

    area: {
      size: Number,
      unit: {
        type: String,
        enum: ["sqft", "guz"],
        default: "sqft",
      },
    },

    bedrooms: Number,
    bathrooms: Number,

    furnishing: {
      type: String,
      enum: ["furnished", "semi-furnished", "unfurnished"],
    },

    address: {
      city: String,
      state: String,
      locality: String,
      pincode: String,
    },

    images: [String],

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    views: { type: Number, default: 0 },
    adminViews: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },

    isFlagged: { type: Boolean, default: false },

    flagReason: String,

    listedBy: {
      type: String,
      enum: ["owner", "dealer"],
      default: "owner",
    },

    isSold: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

propertySchema.index({ priceValue: 1 });
propertySchema.index({ "address.city": 1, "address.locality": 1 });

export default mongoose.model("Property", propertySchema);