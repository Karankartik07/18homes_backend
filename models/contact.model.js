// ========================= contact.model.js (SIMPLIFIED) =========================
import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    property: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },

    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
    },

    message: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["new", "contacted", "site_visit", "closed"],
      default: "new",
    },

    notes: [
      {
        text: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

contactSchema.index({ buyer: 1, property: 1 });
contactSchema.index({ owner: 1, createdAt: -1 });

export default mongoose.model("Contact", contactSchema);
