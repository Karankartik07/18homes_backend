// ========================= contact.model.js (SIMPLIFIED) =========================
import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    property: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
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

    message: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

contactSchema.index({ buyer: 1, property: 1 });
contactSchema.index({ owner: 1, createdAt: -1 });

export default mongoose.model("Contact", contactSchema);
