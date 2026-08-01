import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    projectName: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    builder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reraNumber: {
      type: String,
      trim: true,
      default: "",
    },
    tagline: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
    },
    projectType: {
      type: String,
      enum: ["residential", "commercial", "township", "plots", "mixed"],
      default: "residential",
    },
    projectStatus: {
      type: String,
      enum: ["new_launch", "under_construction", "ready_to_move"],
      default: "under_construction",
    },
    address: {
      locality: { type: String, trim: true },
      city: { type: String, trim: true, required: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
    },
    priceRange: {
      minPrice: { type: Number, default: 0 },
      maxPrice: { type: Number, default: 0 },
      displayPrice: { type: String, trim: true, default: "Price on Request" },
    },
    configurations: [
      {
        bhk: { type: String, trim: true }, // e.g. "2 BHK", "3 BHK", "Villa"
        areaSqft: { type: Number, default: 0 },
        priceText: { type: String, trim: true },
        floorPlanImage: { type: String, trim: true },
      },
    ],
    amenities: [{ type: String, trim: true }],
    images: [{ type: String, trim: true }],
    masterPlanImage: { type: String, trim: true, default: "" },
    brochureUrl: { type: String, trim: true, default: "" },
    possessionDate: { type: Date },
    isActive: { type: Boolean, default: true },
    isApproved: { type: Boolean, default: true },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

projectSchema.index({ builder: 1, createdAt: -1 });
projectSchema.index({ "address.city": 1, projectStatus: 1 });
projectSchema.index({ projectType: 1, isActive: 1 });

export default mongoose.model("Project", projectSchema);
