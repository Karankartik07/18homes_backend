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
      enum: [
        "flat",
        "house",
        "plot",
        "shop",
        "office",
        "apartment",
        "commercial",
        "villa",
        "penthouse",
        "land",
        "agriculture",
        "bank_auction",
        "pre_launch",
        "studio_apartment",
      ],
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
      size: String,
      unit: {
        type: String,
        default: "sqft",
      },
    },

    bedrooms: Number,
    bathrooms: Number,

    furnishing: {
      type: String,
      enum: ["furnished", "fully-furnished", "semi-furnished", "unfurnished"],
    },

    ageOfProperty: {
      type: String,
      default: "",
    },

    balconies: {
      type: Number,
      default: 0,
    },

    amenities: {
      type: [String],
      default: [],
    },

    distances: {
      busStand: { type: String, default: "" },
      metroStation: { type: String, default: "" },
      atm: { type: String, default: "" },
      school: { type: String, default: "" },
      hospital: { type: String, default: "" },
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
    contactClickCount: { type: Number, default: 0 },

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
    isBoosted: {
      type: Boolean,
      default: false,
      index: true,
    },
    boostExpiresAt: {
      type: Date,
      index: true,
    },
    boostPlan: {
      type: String,
    },
    boostCreatedAt: {
      type: Date,
    },
    boostType: {
      type: String,
      enum: ["user", "admin"],
      index: true,
    },
    boostRevenue: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 5.0,
      index: true,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

propertySchema.index({ priceValue: 1 });
propertySchema.index({ averageRating: -1 });
propertySchema.index({ "address.city": 1, "address.locality": 1 });

export default mongoose.model("Property", propertySchema);