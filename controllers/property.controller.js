import Property from "../models/property.model.js";
import User from "../models/user.model.js";
import sendResponse from "../utils/apiResponse.js";
import crypto from "crypto";
import Razorpay from "razorpay";
import BoostPlan from "../models/boostPlan.model.js";
import Payment from "../models/payment.model.js";

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_TAwig7RAJNiuHo",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "xXRO5M464qVSdjcKpW2C4Gw2",
});

const parsePrice = (priceStr) => {
  if (!priceStr) return 0;
  let cleaned = String(priceStr).replace(/[₹,\s]/g, "").toLowerCase();
  
  const match = cleaned.match(/^([\d.]+)([a-z]*)$/);
  if (!match) {
    let num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    if (cleaned.includes("cr") || cleaned.includes("crore")) return num * 10000000;
    if (cleaned.includes("lakh") || cleaned.includes("lac") || cleaned.includes("l")) return num * 100000;
    if (cleaned.includes("k") || cleaned.includes("thousand")) return num * 1000;
    return num;
  }
  
  const numVal = parseFloat(match[1]);
  const suffix = match[2];
  if (isNaN(numVal)) return 0;
  
  if (suffix.includes("cr") || suffix.includes("crore")) return numVal * 10000000;
  if (suffix.includes("lakh") || suffix.includes("lac") || suffix.includes("l")) return numVal * 100000;
  if (suffix.includes("k") || suffix.includes("thousand")) return numVal * 1000;
  return numVal;
};

/* ======================================================
   CREATE PROPERTY (USER)
====================================================== */
export const createProperty = async (req, res) => {
  try {
    const {
      title,
      description,
      purpose,
      propertyType,
      commercialType,
      commercialTypeCustom,
      isHighRise,
      floorNo,
      totalFloors,
      priceText,
      priceValue,
      area,
      bedrooms,
      bathrooms,
      furnishing,
      address,
      images,
      listedBy,
    } = req.body;

    const resolvedPriceValue = priceValue !== undefined && !isNaN(Number(priceValue))
      ? Number(priceValue)
      : parsePrice(priceText);

    const property = await Property.create({
      title,
      description,
      purpose,
      propertyType,
      commercialType: propertyType === "commercial" ? commercialType : undefined,
      commercialTypeCustom: (propertyType === "commercial" && commercialType === "other") ? commercialTypeCustom : undefined,
      isHighRise: (propertyType === "flat" || propertyType === "apartment") ? isHighRise : false,
      floorNo,
      totalFloors,
      priceText, // "Two Hundred Rupees"
      priceValue: resolvedPriceValue, // parsed or safe numeric fallback
      area,
      bedrooms,
      bathrooms,
      furnishing,
      address,
      images,
      owner: req.user._id,
      isActive: true,
      listedBy: listedBy || "owner",
    });

    return sendResponse(
      res,
      201,
      true,
      "Property posted successfully",
      property
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   GET ALL PROPERTIES (PUBLIC)
====================================================== */
export const getAllProperties = async (req, res) => {
  try {
    // Auto-expire any expired boosts dynamically
    await Property.updateMany(
      { isBoosted: true, boostExpiresAt: { $lte: new Date() } },
      { $set: { isBoosted: false } }
    );

    const {
      search,
      city,
      purpose,
      propertyType,
      commercialType,
      commercialTypeCustom,
      minPrice,
      maxPrice,
      bedrooms,
      furnishing,
      isBoosted,
      page = 1,
      limit = 10,
      sort = "-createdAt",
    } = req.query;

    const query = {
      isActive: true,
      isFlagged: false,
    };

    if (isBoosted === "true") {
      query.isBoosted = true;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { priceText: { $regex: search, $options: "i" } },
        { "address.locality": { $regex: search, $options: "i" } },
      ];
    }

    if (city) query["address.city"] = new RegExp(city, "i");
    if (purpose) query.purpose = purpose;
    if (propertyType) query.propertyType = propertyType;
    if (propertyType === "commercial" && commercialType && commercialType !== "all") {
      query.commercialType = commercialType;
      if (commercialType === "other" && commercialTypeCustom) {
        query.commercialTypeCustom = new RegExp("^" + commercialTypeCustom + "$", "i");
      }
    }
    if (bedrooms) query.bedrooms = Number(bedrooms);
    if (furnishing) query.furnishing = furnishing;

    // 🔥 PRICE FILTER (NUMERIC SAFE)
    if (minPrice || maxPrice) {
      query.priceValue = {};
      if (minPrice) query.priceValue.$gte = Number(minPrice);
      if (maxPrice) query.priceValue.$lte = Number(maxPrice);
    }

    const skip = (page - 1) * limit;

    // Build sort object to prioritize boosted properties
    let finalSort = {};
    finalSort.isBoosted = -1; // Boosted properties first
    finalSort.boostCreatedAt = -1; // Latest boosted properties first
    if (typeof sort === "string") {
      const sortField = sort.startsWith("-") ? sort.substring(1) : sort;
      const sortDir = sort.startsWith("-") ? -1 : 1;
      finalSort[sortField] = sortDir;
    } else {
      finalSort.createdAt = -1;
    }

    const [properties, total] = await Promise.all([
      Property.find(query)
        .populate("owner", "name phone")
        .sort(finalSort)
        .skip(skip)
        .limit(Number(limit)),

      Property.countDocuments(query),
    ]);

    return sendResponse(res, 200, true, "Properties fetched successfully", {
      properties,
      pagination: {
        total,
        page: Number(page),
        totalPages: Math.ceil(total / limit),
        limit: Number(limit),
      },
    });
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   GET SINGLE PROPERTY
====================================================== */
export const getPropertyById = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate(
      "owner",
      "name phone email"
    );

    if (!property || !property.isActive || property.isFlagged) {
      return sendResponse(res, 404, false, "Property not found");
    }

    return sendResponse(
      res,
      200,
      true,
      "Property fetched successfully",
      property
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   GET MY PROPERTIES (USER)
====================================================== */
export const getMyProperties = async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user._id }).sort({
      createdAt: -1,
    });

    return sendResponse(
      res,
      200,
      true,
      "Your properties fetched successfully",
      properties
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   UPDATE PROPERTY (OWNER ONLY)
====================================================== */
export const updateProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return sendResponse(res, 404, false, "Property not found");

    if (property.owner.toString() !== req.user._id.toString() && req.user.role !== "admin")
      return sendResponse(res, 403, false, "Not allowed");

    const allowedFields = [
      "title",
      "description",
      "priceText",
      "priceValue",
      "area",
      "bedrooms",
      "bathrooms",
      "furnishing",
      "images",
      "address",
      "listedBy",
      "isSold",
      "commercialType",
      "commercialTypeCustom",
      "isHighRise",
      "floorNo",
      "totalFloors",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        property[field] = req.body[field];
      }
    });

    // Recalculate priceValue if priceText was provided but priceValue was either omitted or is invalid (NaN)
    if (req.body.priceText !== undefined) {
      const isExplicitValueValid = req.body.priceValue !== undefined && !isNaN(Number(req.body.priceValue));
      if (!isExplicitValueValid) {
        property.priceValue = parsePrice(req.body.priceText);
      }
    }

    await property.save();

    return sendResponse(res, 200, true, "Property updated", property);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   DELETE PROPERTY (SOFT DELETE)
====================================================== */
export const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return sendResponse(res, 404, false, "Property not found");
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return sendResponse(res, 403, false, "Not allowed");
    }

    property.isActive = false;
    await property.save();

    return sendResponse(res, 200, true, "Property deleted successfully");
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   ADMIN DELETE PROPERTY (HARD DELETE)
====================================================== */
export const deletePropertyAdmin = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return sendResponse(res, 404, false, "Property not found");
    }

    await property.deleteOne();

    return sendResponse(res, 200, true, "Property deleted by admin");
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   SAVE / UNSAVE PROPERTY
====================================================== */
export const toggleSaveProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property || !property.isActive) {
      return sendResponse(res, 404, false, "Property not found");
    }

    const user = await User.findById(req.user._id);

    const index = user.savedProperties.indexOf(property._id);
    if (index > -1) {
      user.savedProperties.splice(index, 1);
      await user.save();
      return sendResponse(res, 200, true, "Property removed from saved");
    }

    user.savedProperties.push(property._id);
    await user.save();
    return sendResponse(res, 200, true, "Property saved successfully");
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   GET SAVED PROPERTIES
====================================================== */
export const getSavedProperties = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "savedProperties",
      populate: { path: "owner", select: "name phone" },
    });

    return sendResponse(
      res,
      200,
      true,
      "Saved properties fetched",
      user.savedProperties
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   ADMIN: GET ALL PROPERTIES
====================================================== */
export const getAllPropertiesAdmin = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const search = req.query.search?.trim() || "";

    const skip = (page - 1) * limit;

    // 🔍 Search logic
    const query = search
      ? {
          $or: [
            { title: { $regex: search, $options: "i" } },
            { "address.city": { $regex: search, $options: "i" } },
            { "address.locality": { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [properties, total] = await Promise.all([
      Property.find(query)
        .populate("owner", "name phone email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Property.countDocuments(query),
    ]);

    return sendResponse(res, 200, true, "Properties fetched", {
      properties,
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

/* ======================================================
   ADMIN: FLAG / UNFLAG PROPERTY
====================================================== */
export const flagProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return sendResponse(res, 404, false, "Property not found");

    property.isFlagged = !property.isFlagged;
    property.flagReason = property.isFlagged
      ? req.body.reason || "Flagged by admin"
      : null;

    await property.save();

    return sendResponse(
      res,
      200,
      true,
      property.isFlagged ? "Property flagged" : "Property unflagged",
      property
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   ADMIN/USER: INCREMENT PROPERTY VIEWS (CLICK)
====================================================== */
export const incrementPropertyViews = async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!property) {
      return sendResponse(res, 404, false, "Property not found");
    }

    return sendResponse(
      res,
      200,
      true,
      "Property view count incremented successfully",
      { views: property.views }
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   ADMIN: INCREMENT PROPERTY ADMIN VIEWS (CLICK)
====================================================== */
export const incrementPropertyAdminViews = async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { $inc: { adminViews: 1 } },
      { new: true }
    );

    if (!property) {
      return sendResponse(res, 404, false, "Property not found");
    }

    return sendResponse(
      res,
      200,
      true,
      "Property admin view count incremented successfully",
      { adminViews: property.adminViews }
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   PROPERTY BOOSTING ENDPOINTS
====================================================== */

export const getBoostPlans = async (req, res) => {
  try {
    const plans = await BoostPlan.find({}).sort({ durationDays: 1 });
    return sendResponse(res, 200, true, "Boost plans fetched successfully", plans);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

export const updateBoostPlanPrice = async (req, res) => {
  try {
    const { price } = req.body;
    const { planKey } = req.params;

    if (price === undefined || isNaN(Number(price))) {
      return sendResponse(res, 400, false, "Invalid price");
    }

    const plan = await BoostPlan.findOneAndUpdate(
      { key: planKey },
      { price: Number(price) },
      { new: true }
    );

    if (!plan) {
      return sendResponse(res, 404, false, "Boost plan not found");
    }

    return sendResponse(res, 200, true, "Boost plan price updated successfully", plan);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

export const createBoostOrder = async (req, res) => {
  console.log("createBoostOrder hit! id:", req.params.id, "body:", req.body);
  try {
    const { id } = req.params;
    const { planKey } = req.body;

    const property = await Property.findById(id);
    if (!property) {
      return sendResponse(res, 404, false, "Property not found");
    }

    if (property.owner.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return sendResponse(res, 403, false, "Not authorized to boost this property");
    }

    const plan = await BoostPlan.findOne({ key: planKey });
    if (!plan) {
      return sendResponse(res, 404, false, "Boost plan not found");
    }

    const options = {
      amount: plan.price * 100,
      currency: "INR",
      receipt: `b_${id.toString().slice(-6)}_${Date.now()}`,
    };

    const order = await razorpayInstance.orders.create(options);

    await Payment.create({
      propertyId: property._id,
      userId: req.user._id,
      planKey: plan.key,
      amount: plan.price,
      razorpayOrderId: order.id,
      status: "pending",
    });

    return sendResponse(res, 201, true, "Razorpay order created successfully", {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayInstance.key_id,
    });
  } catch (error) {
    console.error("Error in createBoostOrder:", error);
    return sendResponse(res, 500, false, error.message);
  }
};

export const verifyBoostPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planKey,
    } = req.body;

    const shasum = crypto.createHmac("sha256", razorpayInstance.key_secret);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest("hex");

    if (digest !== razorpay_signature) {
      await Payment.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { status: "failed", razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature }
      );
      return sendResponse(res, 400, false, "Payment signature verification failed");
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      return sendResponse(res, 404, false, "Payment record not found");
    }

    const plan = await BoostPlan.findOne({ key: planKey });
    if (!plan) {
      return sendResponse(res, 404, false, "Boost plan not found");
    }

    const boostExpiresAt = new Date();
    boostExpiresAt.setDate(boostExpiresAt.getDate() + plan.durationDays);

    const property = await Property.findByIdAndUpdate(
      id,
      {
        isBoosted: true,
        boostExpiresAt,
        boostPlan: plan.key,
        boostCreatedAt: new Date(),
      },
      { new: true }
    );

    payment.status = "completed";
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    await payment.save();

    return sendResponse(res, 200, true, "Property boosted successfully", property);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

export const getBoostedPropertiesAdmin = async (req, res) => {
  try {
    await Property.updateMany(
      { isBoosted: true, boostExpiresAt: { $lte: new Date() } },
      { $set: { isBoosted: false } }
    );

    const properties = await Property.find({ isBoosted: true })
      .populate("owner", "name phone email")
      .sort({ boostExpiresAt: 1 })
      .lean();

    return sendResponse(res, 200, true, "Boosted properties fetched successfully", properties);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};
