import User from "../models/user.model.js";
import sendResponse from "../utils/apiResponse.js";

// ================= GET ALL USERS (ADMIN) =================
export const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const search = req.query.search?.trim() || "";

    const skip = (page - 1) * limit;

    // 🔍 search condition
    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(query),
    ]);

    return sendResponse(res, 200, true, "Users fetched", {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
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
