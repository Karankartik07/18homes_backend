import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import Property from "../models/property.model.js";

const BACKUP_DIR = path.join(process.cwd(), "backups");

export async function backupPropertiesToFile() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    if (mongoose.connection.readyState !== 1) {
      const mongoUri = process.env.MONGO_URI || "mongodb://Ravi:ravi%4018homes@ac-glfzgff-shard-00-00.dxxn4on.mongodb.net:27017,ac-glfzgff-shard-00-01.dxxn4on.mongodb.net:27017,ac-glfzgff-shard-00-02.dxxn4on.mongodb.net:27017/18homes?ssl=true&replicaSet=atlas-3rcss3-shard-0&authSource=admin&retryWrites=true&w=majority";
      await mongoose.connect(mongoUri);
    }

    const properties = await Property.find().lean();
    const filePath = path.join(BACKUP_DIR, "properties_backup.json");
    
    fs.writeFileSync(filePath, JSON.stringify(properties, null, 2), "utf-8");
    console.log(`[BACKUP SUCCESS] Saved ${properties.length} properties to ${filePath}`);
    return true;
  } catch (err) {
    console.error("[BACKUP ERROR]: Failed to backup properties:", err.message);
    return false;
  }
}
