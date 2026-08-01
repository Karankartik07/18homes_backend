import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema(
  {
    eventType: { type: String, required: true }, // "visitor", "page_view", "view_contact", "phone_click", "whatsapp_click", "time_spent"
    propertyId: { type: String, required: true },
    propertyTitle: { type: String, default: "" },
    builderId: { type: String, default: "" },
    city: { type: String, default: "Ghaziabad" },
    flatUnit: { type: String, default: "A-302" },
    userName: { type: String, default: "Guest Visitor" },
    userEmail: { type: String, default: "guest@18homes.in" },
    userPhone: { type: String, default: "+91 98765 43210" },
    durationSec: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Analytics = mongoose.models.Analytics || mongoose.model("Analytics", analyticsSchema);
export default Analytics;
