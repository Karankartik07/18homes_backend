// ========================= MIDDLEWARE =========================

// auth.middleware.js
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import sendResponse from "../utils/apiResponse.js";

export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return sendResponse(res, 401, false, "Not authorized, token missing");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return sendResponse(res, 401, false, "User no longer exists");
    }

    if (user.isBlocked) {
      return sendResponse(res, 403, false, "Your account is blocked");
    }

    req.user = user;
    next();
  } catch (error) {
    sendResponse(res, 401, false, "Invalid or expired token");
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendResponse(
        res,
        403,
        false,
        `User role '${req.user?.role}' is not authorized to access this route`
      );
    }
    next();
  };
};

export const optionalProtect = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user && !user.isBlocked) {
        req.user = user;
      }
    }
  } catch (error) {
    // Ignore error for optional protect
  }
  next();
};
