// ========================= CONTROLLERS =========================

// auth.controller.js
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sendResponse from "../utils/apiResponse.js";
import { sendMail, forgotPasswordTemplate } from "../utils/sendMail.js";
import crypto from "crypto";
import { generateResetToken } from "../utils/generateToken.js";

export const register = async (req, res) => {
  try {
    const { name, email, phone, password, userType, address } = req.body;

    // ================= CHECK EXISTING USER =================
    const exists = await User.findOne({ email });
    if (exists) {
      return sendResponse(res, 409, false, "Email already registered");
    }

    // ================= CREATE USER =================
    const user = await User.create({
      name,
      email,
      phone,
      password,
      userType,
      address,
    });

    // ================= REMOVE SENSITIVE DATA =================
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.kyc;

    // ================= RESPONSE =================
    return sendResponse(
      res,
      201,
      true,
      "Registration successful",
      userResponse,
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ================= CHECK USER =================
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return sendResponse(res, 401, false, "Invalid email or password");
    }

    // ================= BLOCK CHECK =================
    if (user.isBlocked) {
      return sendResponse(res, 403, false, "Your account has been blocked");
    }

    // ================= PASSWORD MATCH =================
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendResponse(res, 401, false, "Invalid email or password");
    }

    // ================= UPDATE LAST LOGIN =================
    user.lastLogin = new Date();
    await user.save();

    // ================= JWT TOKEN =================
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // ================= CLEAN USER DATA =================
    const userData = user.toObject();
    delete userData.password;
    delete userData.kyc;

    // ================= RESPONSE =================
    return sendResponse(res, 200, true, "Login successful", {
      token,
      user: userData,
    });
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, false, error.message);
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: "savedProperties",
        select: "title price images address purpose propertyType",
      })
      .select("-password");

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    // Convert to plain object and manually delete sensitive kyc fields to avoid projection collision
    const userData = user.toObject();
    delete userData.kyc;

    return sendResponse(
      res,
      200,
      true,
      "Profile fetched successfully",
      userData,
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, avatar, userType, address } = req.body;

    // ================= BUILD UPDATE OBJECT =================
    const updates = {};

    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (avatar) updates.avatar = avatar;
    if (userType) updates.userType = userType;

    // ================= ADDRESS UPDATE =================
    if (address && typeof address === "object") {
      updates.address = {};

      if (address.houseNo !== undefined)
        updates.address.houseNo = address.houseNo;
      if (address.street !== undefined) updates.address.street = address.street;
      if (address.locality !== undefined)
        updates.address.locality = address.locality;
      if (address.city !== undefined) updates.address.city = address.city;
      if (address.district !== undefined)
        updates.address.district = address.district;
      if (address.state !== undefined) updates.address.state = address.state;
      if (address.pincode) updates.address.pincode = address.pincode;
    }

    // ================= UPDATE USER =================
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      },
    ).select("-password");

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    // Convert to plain object and manually delete sensitive kyc fields to avoid projection collision
    const userData = user.toObject();
    delete userData.kyc;

    return sendResponse(
      res,
      200,
      true,
      "Profile updated successfully",
      userData,
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email, frontendUrl } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    // 🔒 Do NOT reveal if user exists (security best practice)
    if (!user) {
      return res.json({
        success: true,
        message: "If this email exists, reset link has been sent",
      });
    }

    const { token, hashedToken } = generateResetToken();

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 min

    // ✅ IMPORTANT FIX
    await user.save({ validateBeforeSave: false });

    const frontendBaseUrl =
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      (frontendUrl &&
      !frontendUrl.includes("localhost") &&
      !frontendUrl.includes("127.0.0.1")
        ? frontendUrl
        : "https://18homes.in");

    const resetUrl = `${frontendBaseUrl.replace(/\/$/, "")}/reset-password/${token}`;

    // ✅ OPTIONAL: EMAIL SEND

    await sendMail({
      to: user.email,
      subject: "Reset Your Password",
      html: forgotPasswordTemplate(user.name || user.email, resetUrl),
    });

    return res.json({
      success: true,
      message: "Password reset link sent",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Token and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // 🔥 STEP 1: FIND USER
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Token invalid or expired",
      });
    }

    // 🔥 STEP 2: UPDATE PASSWORD (SAFE)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    // ❌ validation error fix
    await user.save({ validateBeforeSave: false });

    return res.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to reset password",
    });
  }
};
