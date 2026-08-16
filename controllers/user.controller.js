import User from "../models/user.model.js";
import UserSubscription from "../models/userSubscription.model.js";
import Plan from "../models/plan.model.js";
import sendResponse from "../utils/apiResponse.js";

// ================= GET ALL USERS (ADMIN) =================
export const getAllUsers = async (req, res) => {
  try {
    // Auto-expire any expired subscriptions dynamically
    await UserSubscription.updateMany(
      { status: "active", expiryDate: { $lte: new Date() } },
      { $set: { status: "expired" } }
    );

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const search = req.query.search?.trim() || "";
    const role = req.query.role?.trim() || "";
    const status = req.query.status?.trim() || ""; // "active" | "blocked"
    const approvalStatus = req.query.approvalStatus?.trim() || ""; // "approved" | "pending" | "rejected"
    const planStatus = req.query.planStatus?.trim() || ""; // "active" | "expired" | "none"
    const planName = req.query.planName?.trim() || "";
    const assignedByAdminParam = req.query.assignedByAdmin?.trim() || ""; // "true" | "false"

    const query = {};

    // 🔍 Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // 🎭 Role filter
    if (role && role !== "all") {
      query.role = role;
    }

    // 🔒 Account Status filter
    if (status === "active") {
      query.isBlocked = false;
    } else if (status === "blocked") {
      query.isBlocked = true;
    }

    // ✅ Verification / Approval Status filter
    if (approvalStatus && approvalStatus !== "all") {
      query.approvalStatus = approvalStatus;
    }

    // 👑 Plan Filters (Status / Name / Admin Assignment)
    if (planStatus || (planName && planName !== "all") || assignedByAdminParam) {
      const subFilter = {};

      if (planName && planName !== "all") {
        subFilter.planName = new RegExp("^" + planName + "$", "i");
      }

      if (planStatus === "active") {
        subFilter.status = "active";
        subFilter.expiryDate = { $gt: new Date() };
      } else if (planStatus === "expired") {
        subFilter.status = "expired";
      }

      if (assignedByAdminParam === "true") {
        subFilter.assignedByAdmin = true;
      } else if (assignedByAdminParam === "false") {
        subFilter.assignedByAdmin = { $ne: true };
      }

      if (planStatus === "none") {
        const subscribedUserIds = await UserSubscription.distinct("userId");
        query._id = { $nin: subscribedUserIds };
      } else {
        const matchedUserIds = await UserSubscription.distinct("userId", subFilter);
        query._id = { $in: matchedUserIds };
      }
    }

    const skip = (page - 1) * limit;

    const [users, total, revenueResult, planBreakdownRaw, allSubscriptions, availablePlans] = await Promise.all([
      User.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(query),

      // Total Membership Revenue
      UserSubscription.aggregate([
        { $match: { amount: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // Revenue and Purchase Breakdown per Plan
      UserSubscription.aggregate([
        {
          $group: {
            _id: "$planName",
            totalRevenue: { $sum: "$amount" },
            activeSubscribers: {
              $sum: {
                $cond: [{ $and: [{ $eq: ["$status", "active"] }, { $gt: ["$expiryDate", new Date()] }] }, 1, 0],
              },
            },
            totalPurchases: { $sum: 1 },
          },
        },
        { $sort: { totalRevenue: -1 } },
      ]),

      // All subscriptions populated with user info for Purchaser Details list
      UserSubscription.find({})
        .populate("userId", "name email phone role avatar")
        .sort({ createdAt: -1 })
        .lean(),

      // Available active membership plans
      Plan.find({ active: true }).select("name role price duration").lean(),
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;

    const planBreakdown = planBreakdownRaw.map((p) => ({
      planName: p._id || "Custom Plan",
      totalRevenue: p.totalRevenue || 0,
      activeSubscribers: p.activeSubscribers || 0,
      totalPurchases: p.totalPurchases || 0,
    }));

    // Attach active or latest subscription to each user
    const subMap = {};
    allSubscriptions.forEach((sub) => {
      const uId = sub.userId?._id ? sub.userId._id.toString() : sub.userId?.toString();
      if (uId) {
        if (!subMap[uId] || (sub.status === "active" && subMap[uId].status !== "active")) {
          subMap[uId] = {
            _id: sub._id,
            planName: sub.planName,
            amount: sub.amount,
            status: sub.status,
            startDate: sub.startDate,
            expiryDate: sub.expiryDate,
            invoiceNumber: sub.invoiceNumber,
            paymentId: sub.paymentId || sub.razorpayPaymentId,
            transactionId: sub.transactionId,
            assignedByAdmin: Boolean(sub.assignedByAdmin),
            createdAt: sub.createdAt,
          };
        }
      }
    });

    const usersWithPlan = users.map((u) => ({
      ...u,
      subscription: subMap[u._id.toString()] || null,
    }));

    return sendResponse(res, 200, true, "Users fetched successfully", {
      users: usersWithPlan,
      totalRevenue,
      planBreakdown,
      allSubscriptions,
      availablePlans,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getAllUsers error:", error);
    return sendResponse(res, 500, false, error.message);
  }
};


// ================= GET USER BY ID (ADMIN) =================
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    return sendResponse(res, 200, true, "User fetched successfully", user);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// ================= UPDATE USER (ADMIN) =================
export const updateUser = async (req, res) => {
  try {
    const { name, phone, role, userType, avatar, address, isBlocked } =
      req.body;

    // ===== WHITELIST UPDATE FIELDS =====
    const updates = {};

    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (avatar) updates.avatar = avatar;

    // Admin-only sensitive controls
    if (role) updates.role = role; // admin / user
    if (userType) updates.userType = userType; // buyer / seller / agent
    if (typeof isBlocked === "boolean") updates.isBlocked = isBlocked;

    // Address update (safe)
    if (address && typeof address === "object") {
      updates.address = {};
      if (address.houseNo) updates.address.houseNo = address.houseNo;
      if (address.street) updates.address.street = address.street;
      if (address.locality) updates.address.locality = address.locality;
      if (address.city) updates.address.city = address.city;
      if (address.district) updates.address.district = address.district;
      if (address.state) updates.address.state = address.state;
      if (address.pincode) updates.address.pincode = address.pincode;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    return sendResponse(res, 200, true, "User updated successfully", user);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// ================= DELETE USER (ADMIN) =================
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    return sendResponse(res, 200, true, "User deleted successfully");
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// ================= BLOCK / UNBLOCK USER (ADMIN) =================
export const toggleBlockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    return sendResponse(
      res,
      200,
      true,
      `User ${user.isBlocked ? "blocked" : "unblocked"} successfully`,
      user
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// ================= GET PENDING APPROVALS (ADMIN) =================
export const getPendingApprovals = async (req, res) => {
  try {
    const users = await User.find({
      role: { $in: ["builder", "dealer"] },
      approvalStatus: "pending",
    })
      .select("-password")
      .sort({ createdAt: -1 });

    return sendResponse(res, 200, true, "Pending user approvals fetched", users);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// ================= APPROVE USER (ADMIN) =================
export const approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    user.approvalStatus = "approved";
    await user.save();

    return sendResponse(
      res,
      200,
      true,
      `User ${user.name || user.email} has been approved successfully!`,
      user
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

// ================= REJECT USER (ADMIN) =================
export const rejectUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    user.approvalStatus = "rejected";
    await user.save();

    return sendResponse(
      res,
      200,
      true,
      `User ${user.name || user.email} application was rejected`,
      user
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};
