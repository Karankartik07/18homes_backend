// ========================= APP.JS =========================
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import propertyRoutes from "./routes/property.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import userRoutes from "./routes/user.routes.js";
import mediaRoutes from "./routes/media.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

import seedRoutes from "./routes/seed.apis.js";

const app = express(); 

// ✅ Allow CORS for all origins
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to the Real Estate API");
} );

app.use("/api/media", mediaRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);

app.use("/api/seed", seedRoutes);

export default app;

