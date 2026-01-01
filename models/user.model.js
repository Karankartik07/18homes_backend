import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// ================= ADDRESS SUB-SCHEMA =================
const addressSchema = new mongoose.Schema(
  {
    houseNo: { type: String, trim: true },
    street: { type: String, trim: true },
    locality: { type: String, trim: true },
    city: { type: String, trim: true },
    district: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: {
      type: String,
      match: [/^[1-9][0-9]{5}$/, "Invalid Indian pincode"],
    },
    country: {
      type: String,
      default: "India",
    },
  },
  { _id: false }
);

// ================= USER SCHEMA =================
const userSchema = new mongoose.Schema(
  {
    // BASIC INFO
    name: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    phone: {
      type: String,
      match: [/^[6-9][0-9]{9}$/, "Invalid Indian mobile number"],
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    avatar: {
      type: String, // Cloudinary URL
    },

    // USER ROLE & TYPE
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },

    // userType: {
    //   type: String,
    //   enum: ["buyer", "seller", "agent"],
    //   default: "buyer",
    // },

    // ADDRESS
    address: addressSchema,

    // OPTIONAL KYC (Future ready)
    kyc: {
      aadhaarNumber: {
        type: String,
        select: false,
      },
      panNumber: {
        type: String,
        uppercase: true,
        select: false,
      },
      isVerified: {
        type: Boolean,
        default: false,
      },
    },

    // REAL ESTATE RELATED
    savedProperties: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
    ],

    isBlocked: {
      type: Boolean,
      default: false,
    },

    lastLogin: {
      type: Date,
    },
    // PASSWORD RESET TOKEN
    resetPasswordToken: {
      type: String,
      select: false,
    },

    resetPasswordExpire: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

// ================= PASSWORD HASH =================
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

export default mongoose.model("User", userSchema);
