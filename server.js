// ========================= SERVER.JS =========================
import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./config/db.js";

dotenv.config();

connectDB();

const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`🚀 Server running on port http://localhost:${PORT}`));
}

export default app;