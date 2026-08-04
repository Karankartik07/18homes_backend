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

    // USER ROLE & APPROVAL STATUS
    role: {
      type: String,
      enum: ["admin", "user", "owner", "builder", "dealer"],
      default: "user",
    },

    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },

    profileCompleted: {
      type: Boolean,
      default: false,
    },

    // ADDRESS
    address: addressSchema,

    // KYC DETAILS
    kyc: {
      aadhaarNumber: {
        type: String,
        trim: true,
      },
      panNumber: {
        type: String,
        uppercase: true,
        trim: true,
      },
      isVerified: {
        type: Boolean,
        default: false,
      },
    },

    // BUILDER DETAILS
    builderDetails: {
      firmName: { type: String, trim: true },
      completedProjectsCount: { type: Number, default: 0 },
      runningProjectsCount: { type: Number, default: 0 },
      runningProjectsNames: { type: String, trim: true },
      upcomingProjects: { type: String, trim: true },
      officeAddress: { type: String, trim: true },
      reraNumber: { type: String, trim: true },
      gstNumber: { type: String, trim: true, uppercase: true },
      panNumber: { type: String, trim: true, uppercase: true },
      aadhaarNumber: { type: String, trim: true },
    },

    // DEALER / AGENT DETAILS
    dealerDetails: {
      agencyName: { type: String, trim: true },
      experienceYears: { type: Number, default: 0 },
      operatingAreas: { type: String, trim: true },
      officeAddress: { type: String, trim: true },
      licenseNumber: { type: String, trim: true },
      gstNumber: { type: String, trim: true, uppercase: true },
      panNumber: { type: String, trim: true, uppercase: true },
      aadhaarNumber: { type: String, trim: true },
    },

    // REAL ESTATE RELATED
    savedProperties: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
    ],

    recentHistory: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
    ],

    isBlocked: {
      type: Boolean,
      default: false,
    },

    lastLogin: {
      type: Date,
    },

    // EMAIL VERIFICATION OTP
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      select: false,
    },
    otpExpires: {
      type: Date,
      select: false,
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
