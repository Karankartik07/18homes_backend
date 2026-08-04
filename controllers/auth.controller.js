// ========================= CONTROLLERS =========================

// auth.controller.js
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sendResponse from "../utils/apiResponse.js";
import { sendMail, forgotPasswordTemplate, otpEmailTemplate } from "../utils/sendMail.js";
import crypto from "crypto";
import { generateResetToken } from "../utils/generateToken.js";
import { getUserPlanDetails } from "../utils/subscriptionHelper.js";

export const register = async (req, res) => {
  try {
    const { name, email, phone, password, role, address } = req.body;

    // ================= CHECK EXISTING USER =================
    const exists = await User.findOne({ email });
    if (exists) {
      if (!exists.isEmailVerified) {
        // User created earlier but unverified - regenerate OTP and allow verification
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        exists.otp = otp;
        exists.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
        if (name) exists.name = name;
        if (phone) exists.phone = phone;
        if (password) exists.password = password; // Pre-save hook will hash it
        await exists.save();

        try {
          await sendMail({
            to: exists.email,
            subject: "Verify Your Email - 18Homes",
            html: otpEmailTemplate(exists.name, otp),
          });
        } catch (mailErr) {
          console.error("Failed to send OTP email:", mailErr);
        }

        const userResponse = exists.toObject();
        delete userResponse.password;
        delete userResponse.otp;
        delete userResponse.otpExpires;

        return sendResponse(
          res,
          200,
          true,
          "An unverified account exists. A new OTP has been sent to your email.",
          { user: userResponse, requiresVerification: true }
        );
      }

      return sendResponse(res, 409, false, "Email already registered");
    }

    // Role validation
    const validRoles = ["user", "owner", "builder", "dealer"];
    const userRole = validRoles.includes(role) ? role : "user";
    
    // Builders and Dealers require Admin Approval by default
    const initialApprovalStatus = (userRole === "builder" || userRole === "dealer") ? "pending" : "approved";

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // ================= CREATE USER =================
    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: userRole,
      approvalStatus: initialApprovalStatus,
      profileCompleted: false,
      address,
      isEmailVerified: false,
      otp,
      otpExpires,
    });

    // Send OTP email
    try {
      await sendMail({
        to: user.email,
        subject: "Verify Your Email - 18Homes",
        html: otpEmailTemplate(user.name, otp),
      });
    } catch (mailErr) {
      console.error("Failed to send OTP email:", mailErr);
    }

    // ================= REMOVE SENSITIVE DATA =================
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.otp;
    delete userResponse.otpExpires;

    // ================= RESPONSE =================
    return sendResponse(
      res,
      201,
      true,
      "Registration successful! Please verify the OTP sent to your email.",
      { user: userResponse, requiresVerification: true }
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return sendResponse(res, 400, false, "Email and OTP are required");
    }

    const user = await User.findOne({ email }).select("+otp +otpExpires");
    if (!user) {
      return sendResponse(res, 440, false, "User not found");
    }

    if (user.isEmailVerified) {
      return sendResponse(res, 200, true, "Email is already verified. You can log in.");
    }

    if (!user.otp || user.otp !== otp.trim()) {
      return sendResponse(res, 400, false, "Invalid OTP code");
    }

    if (new Date(user.otpExpires).getTime() < Date.now()) {
      return sendResponse(res, 400, false, "OTP has expired. Please request a new OTP.");
    }

    // Mark user as verified
    user.isEmailVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return sendResponse(res, 200, true, "Email verified successfully! Please sign in to your account.");
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return sendResponse(res, 500, false, error.message);
  }
};

export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendResponse(res, 400, false, "Email is required");
    }

    const user = await User.findOne({ email }).select("+otp +otpExpires");
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    if (user.isEmailVerified) {
      return sendResponse(res, 400, false, "Email is already verified.");
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save({ validateBeforeSave: false });

    await sendMail({
      to: user.email,
      subject: "Verify Your Email - 18Homes",
      html: otpEmailTemplate(user.name, otp),
    });

    return sendResponse(res, 200, true, "A new OTP has been sent to your email.");
  } catch (error) {
    console.error("Resend OTP Error:", error);
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

    // ================= EMAIL VERIFICATION CHECK =================
    // Note: If isEmailVerified is explicitly false, prevent login
    if (user.isEmailVerified === false) {
      return sendResponse(
        res,
        403,
        false,
        "Email not verified. Please verify your OTP sent to your email before logging in.",
        { requiresVerification: true, email: user.email }
      );
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

    const userData = user.toObject();

    // Dynamically inject active subscription details
    const planDetails = await getUserPlanDetails(user._id, user.role);
    userData.subscription = planDetails.subscription;
    userData.planName = planDetails.rules.name;
    userData.planRules = planDetails.rules;

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
    const { name, phone, avatar, role, address, kyc, builderDetails, dealerDetails } = req.body;

    // ================= BUILD UPDATE OBJECT =================
    const updates = {};

    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (avatar) updates.avatar = avatar;
    if (role && ["user", "owner", "builder", "dealer"].includes(role)) {
      updates.role = role;
    }

    // ================= ADDRESS UPDATE =================
    if (address && typeof address === "object") {
      updates.address = {};

      if (address.houseNo !== undefined) updates.address.houseNo = address.houseNo;
      if (address.street !== undefined) updates.address.street = address.street;
      if (address.locality !== undefined) updates.address.locality = address.locality;
      if (address.city !== undefined) updates.address.city = address.city;
      if (address.district !== undefined) updates.address.district = address.district;
      if (address.state !== undefined) updates.address.state = address.state;
      if (address.pincode) updates.address.pincode = address.pincode;
    }

    // ================= KYC UPDATE =================
    if (kyc && typeof kyc === "object") {
      updates.kyc = { ...req.user.kyc };
      if (kyc.aadhaarNumber !== undefined) updates.kyc.aadhaarNumber = kyc.aadhaarNumber;
      if (kyc.panNumber !== undefined) updates.kyc.panNumber = kyc.panNumber;
    }

    // ================= BUILDER DETAILS UPDATE =================
    if (builderDetails && typeof builderDetails === "object") {
      updates.builderDetails = {
        firmName: builderDetails.firmName || "",
        completedProjectsCount: Number(builderDetails.completedProjectsCount) || 0,
        runningProjectsCount: Number(builderDetails.runningProjectsCount) || 0,
        runningProjectsNames: builderDetails.runningProjectsNames || "",
        upcomingProjects: builderDetails.upcomingProjects || "",
        officeAddress: builderDetails.officeAddress || "",
        reraNumber: builderDetails.reraNumber || "",
        gstNumber: builderDetails.gstNumber || "",
        panNumber: builderDetails.panNumber || "",
        aadhaarNumber: builderDetails.aadhaarNumber || "",
      };
    }

    // ================= DEALER DETAILS UPDATE =================
    if (dealerDetails && typeof dealerDetails === "object") {
      updates.dealerDetails = {
        agencyName: dealerDetails.agencyName || "",
        experienceYears: Number(dealerDetails.experienceYears) || 0,
        operatingAreas: dealerDetails.operatingAreas || "",
        officeAddress: dealerDetails.officeAddress || "",
        licenseNumber: dealerDetails.licenseNumber || "",
        gstNumber: dealerDetails.gstNumber || "",
        panNumber: dealerDetails.panNumber || "",
        aadhaarNumber: dealerDetails.aadhaarNumber || "",
      };
    }

    // Determine profile completion flag
    const currentRole = updates.role || req.user.role;
    let completed = true;

    if (currentRole === "owner") {
      const currentAadhaar = updates.kyc?.aadhaarNumber || req.user.kyc?.aadhaarNumber;
      const currentPan = updates.kyc?.panNumber || req.user.kyc?.panNumber;
      if (!currentAadhaar && !currentPan) {
        completed = false;
      }
    } else if (currentRole === "builder") {
      const bDetails = updates.builderDetails || req.user.builderDetails;
      if (!bDetails?.firmName || (!bDetails?.reraNumber && !bDetails?.gstNumber && !bDetails?.panNumber && !bDetails?.aadhaarNumber)) {
        completed = false;
      }
    } else if (currentRole === "dealer") {
      const dDetails = updates.dealerDetails || req.user.dealerDetails;
      if (!dDetails?.agencyName || (!dDetails?.licenseNumber && !dDetails?.gstNumber && !dDetails?.panNumber && !dDetails?.aadhaarNumber)) {
        completed = false;
      }
    }

    updates.profileCompleted = completed;

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

    const userData = user.toObject();

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
