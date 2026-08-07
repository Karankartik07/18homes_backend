import Property from "../models/property.model.js";
import User from "../models/user.model.js";
import sendResponse from "../utils/apiResponse.js";
import crypto from "crypto";
import Razorpay from "razorpay";
import BoostPlan from "../models/boostPlan.model.js";
import Payment from "../models/payment.model.js";
import Notification from "../models/notification.model.js";
import Analytics from "../models/analytics.model.js";
import { backupPropertiesToFile } from "../utils/backupHelper.js";
import { getUserPlanDetails } from "../utils/subscriptionHelper.js";

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_TLOcW73PhlSHBW",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "1nwIrTcZVxGzBfm7OLeWWKvT",
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
    // Normal Users ("user") cannot sell/create properties
    if (req.user && req.user.role === "user") {
      return sendResponse(
        res,
        403,
        false,
        "Normal users are only allowed to buy/view properties. Please switch your role to Property Owner, Builder, or Dealer to list properties."
      );
    }
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
      ageOfProperty,
      balconies,
      amenities,
      distances,
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
      ageOfProperty,
      balconies,
      amenities,
      distances,
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
      areaUnit,
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

    // Build category and unit filtering cleanly to avoid Mongoose $or overwrite conflicts
    let typeConditions = [];
    if (propertyType) {
      if (propertyType === "agriculture" || propertyType === "land") {
        const landRegex = /land|acre|bigha|biswa|hectare/i;
        typeConditions.push({
          $or: [
            { propertyType: { $in: ["agriculture", "land"] } },
            {
              propertyType: "commercial",
              $or: [
                { commercialType: landRegex },
                { commercialTypeCustom: landRegex },
                { title: landRegex },
                { description: landRegex }
              ]
            }
          ]
        });
      } else if (propertyType === "flat" || propertyType === "apartment") {
        typeConditions.push({ propertyType: { $in: ["flat", "apartment"] } });
      } else if (propertyType === "bank_auction") {
        typeConditions.push({
          $or: [
            { propertyType: "bank_auction" },
            { title: /bank auction|auction/i },
            { description: /bank auction|auction/i }
          ]
        });
      } else if (propertyType === "pre_launch") {
        typeConditions.push({
          $or: [
            { propertyType: "pre_launch" },
            { title: /pre launch|pre-launch|investment/i },
            { description: /pre launch|pre-launch|investment/i }
          ]
        });
      } else if (propertyType === "studio_apartment") {
        typeConditions.push({
          $or: [
            { propertyType: "studio_apartment" },
            { title: /studio/i },
            { description: /studio/i }
          ]
        });
      } else {
        typeConditions.push({ propertyType });
      }
    }

    if (propertyType === "commercial" && commercialType && commercialType !== "all") {
      typeConditions.push({ commercialType });
      if (commercialType === "other" && commercialTypeCustom) {
        typeConditions.push({ commercialTypeCustom: new RegExp("^" + commercialTypeCustom + "$", "i") });
      }
    }

    if (areaUnit) {
      const areaUnitRegex = new RegExp(areaUnit, "i");
      typeConditions.push({
        $or: [
          { "area.unit": new RegExp("^" + areaUnit + "$", "i") },
          {
            propertyType: "commercial",
            $or: [
              { commercialType: areaUnitRegex },
              { commercialTypeCustom: areaUnitRegex }
            ]
          }
        ]
      });
    }

    if (typeConditions.length > 0) {
      query.$and = typeConditions;
    }

    if (bedrooms) {
      const bNum = Number(bedrooms);
      if (bNum >= 4) {
        query.bedrooms = { $gte: 4 };
      } else {
        query.bedrooms = bNum;
      }
    }
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
        .populate("owner", "name phone role")
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
      "name phone email role"
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
      "ageOfProperty",
      "balconies",
      "amenities",
      "distances",
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
      populate: { path: "owner", select: "name phone role" },
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
    const { isSold, boostStatus } = req.query;

    const skip = (page - 1) * limit;

    // 🔍 Build Query
    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { "address.city": { $regex: search, $options: "i" } },
        { "address.locality": { $regex: search, $options: "i" } },
      ];
    }

    if (isSold === "sold") {
      query.isSold = true;
    } else if (isSold === "available") {
      query.isSold = { $ne: true };
    }

    if (boostStatus === "boosted") {
      query.isBoosted = true;
    } else if (boostStatus === "paid") {
      query.isBoosted = true;
      query.boostType = "user";
    } else if (boostStatus === "admin") {
      query.isBoosted = true;
      query.boostType = "admin";
    } else if (boostStatus === "expired") {
      query.isBoosted = false;
      query.boostExpiresAt = { $lte: new Date() };
    }

    // Auto-expire any expired boosts dynamically before executing queries
    await Property.updateMany(
      { isBoosted: true, boostExpiresAt: { $lte: new Date() } },
      { $set: { isBoosted: false } }
    );

    const [properties, total, revenueResult] = await Promise.all([
      Property.find(query)
        .populate("owner", "name phone email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Property.countDocuments(query),

      Payment.aggregate([
        { $match: { status: "completed", amount: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;

    return sendResponse(res, 200, true, "Properties fetched", {
      properties,
      totalRevenue,
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
   ADMIN/USER: INCREMENT PROPERTY CONTACT CLICKS
====================================================== */
export const incrementPropertyContactClicks = async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { $inc: { contactClickCount: 1 } },
      { new: true }
    );

    if (!property) {
      return sendResponse(res, 404, false, "Property not found");
    }

    return sendResponse(
      res,
      200,
      true,
      "Property contact click count incremented successfully",
      { contactClickCount: property.contactClickCount }
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

    if (req.user.role === "admin") {
      const boostExpiresAt = new Date();
      boostExpiresAt.setDate(boostExpiresAt.getDate() + plan.durationDays);

      const updatedProperty = await Property.findByIdAndUpdate(
        id,
        {
          isBoosted: true,
          boostExpiresAt,
          boostPlan: plan.key,
          boostCreatedAt: new Date(),
          boostType: "admin",
          boostRevenue: 0,
        },
        { new: true }
      );

      // Create a completed payment log for tracking
      await Payment.create({
        propertyId: property._id,
        userId: req.user._id,
        planKey: plan.key,
        amount: 0,
        razorpayOrderId: `admin_free_${Date.now()}`,
        razorpayPaymentId: `admin_free_pay_${Date.now()}`,
        status: "completed",
      });

      try {
        await Notification.create({
          userId: property.owner,
          type: "payment_success",
          title: "Boost Activated by Admin! 🚀",
          message: `Your property "${property.title}" has been successfully boosted with plan "${plan.name || planKey}" by Admin.`,
          metadata: {
            propertyId: property._id,
          },
        });
      } catch (notifError) {
        console.error("Failed to create notification on admin boost:", notifError);
      }

      return sendResponse(res, 201, true, "Property boosted successfully for free (Admin)", {
        isFree: true,
        property: updatedProperty,
      });
    }

    const planDetails = await getUserPlanDetails(req.user._id, req.user.role);
    const discount = planDetails?.rules?.boostDiscount || 0;
    const discountedPrice = Math.round(plan.price * (1 - discount / 100));

    const options = {
      amount: discountedPrice * 100,
      currency: "INR",
      receipt: `b_${id.toString().slice(-6)}_${Date.now()}`,
    };

    const order = await razorpayInstance.orders.create(options);

    await Payment.create({
      propertyId: property._id,
      userId: req.user._id,
      planKey: plan.key,
      amount: discountedPrice,
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
    const errorMessage = error.message || error.description || (error.error && error.error.description) || JSON.stringify(error) || "Failed to create boost order";
    return sendResponse(res, 500, false, errorMessage);
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
        boostType: "user",
        boostRevenue: payment.amount,
      },
      { new: true }
    );

    payment.status = "completed";
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    await payment.save();

    // Create a payment success notification
    try {
      await Notification.create({
        userId: property.owner,
        type: "payment_success",
        title: "Boost Activated! 🚀",
        message: `Your property "${property.title}" has been successfully boosted with plan "${plan.name || planKey}".`,
        metadata: {
          propertyId: property._id,
          paymentId: payment._id,
        },
      });
    } catch (notifError) {
      console.error("Failed to create notification on boost payment:", notifError);
    }

    return sendResponse(res, 200, true, "Property boosted successfully", property);
  } catch (error) {
    console.error("Error in verifyBoostPayment:", error);
    const errorMessage = error.message || error.description || (error.error && error.error.description) || JSON.stringify(error) || "Failed to verify boost payment";
    return sendResponse(res, 500, false, errorMessage);
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

/* ======================================================
   ADD TO RECENT HISTORY
====================================================== */
export const addToHistoryProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property || !property.isActive) {
      return sendResponse(res, 404, false, "Property not found");
    }

    const user = await User.findById(req.user._id);
    if (!user.recentHistory) {
      user.recentHistory = [];
    }

    // Remove if already exists to put it at the beginning of the list
    const index = user.recentHistory.indexOf(property._id);
    if (index > -1) {
      user.recentHistory.splice(index, 1);
    }

    user.recentHistory.unshift(property._id);

    // Limit to 20 items
    if (user.recentHistory.length > 20) {
      user.recentHistory = user.recentHistory.slice(0, 20);
    }

    await user.save();
    return sendResponse(res, 200, true, "Property added to history successfully");
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   GET RECENT HISTORY PROPERTIES
====================================================== */
export const getHistoryProperties = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "recentHistory",
      populate: { path: "owner", select: "name phone role" },
    });

    // Handle case where history field might not exist on old user records
    const history = user.recentHistory || [];

    return sendResponse(
      res,
      200,
      true,
      "Recent history properties fetched",
      history
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   REMOVE FROM RECENT HISTORY
====================================================== */
export const deleteFromHistoryProperty = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const propertyId = req.params.id;

    if (user.recentHistory) {
      const index = user.recentHistory.indexOf(propertyId);
      if (index > -1) {
        user.recentHistory.splice(index, 1);
        await user.save();
      }
    }

    return sendResponse(res, 200, true, "Property removed from history");
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   CLEAR RECENT HISTORY
====================================================== */
export const clearHistoryProperties = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.recentHistory = [];
    await user.save();

    return sendResponse(res, 200, true, "Recent history cleared");
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   BUILDER ANALYTICS: TRACK EVENT
====================================================== */
export const trackAnalyticsEvent = async (req, res) => {
  try {
    const {
      eventType,
      propertyId,
      propertyTitle,
      builderId,
      city,
      flatUnit,
      userName,
      userEmail,
      userPhone,
      durationSec,
      timestamp,
    } = req.body;

    if (!eventType || !propertyId) {
      return sendResponse(res, 400, false, "eventType and propertyId are required");
    }

    const eventRecord = await Analytics.create({
      eventType,
      propertyId,
      propertyTitle: propertyTitle || "Property Listing",
      builderId: builderId || "builder",
      city: city || "Ghaziabad",
      flatUnit: flatUnit || "A-302",
      userName: userName || "Guest Visitor",
      userEmail: userEmail || "visitor@18homes.in",
      userPhone: userPhone || "+91 98765 43210",
      durationSec: durationSec || 0,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    return sendResponse(res, 200, true, "Analytics event recorded", eventRecord);
  } catch (error) {
    console.error("Error tracking analytics event:", error);
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   BUILDER ANALYTICS: GET BUILDER METRICS & USER LOGS
====================================================== */
export const getBuilderAnalytics = async (req, res) => {
  try {
    const { builderId, builderEmail } = req.query;
    let filter = {};
    if (builderId) {
      filter = {
        $or: [
          { builderId: builderId },
          { builderId: "builder" },
          { builderId: "" },
          { builderId: { $exists: false } },
          { builderEmail: builderEmail ? builderEmail.toLowerCase() : "" }
        ]
      };
    }

    const events = await Analytics.find(filter).sort({ timestamp: -1 }).limit(1000);

    // Resolve subscription plan analytics access level
    const { rules } = await getUserPlanDetails(req.user._id, req.user.role);
    const tabsAllowed = rules?.analyticsAccess || 1; // default to basic (1 tab)

    let finalEvents = [];
    if (tabsAllowed >= 7) {
      finalEvents = events;
    } else if (tabsAllowed >= 5) {
      const allowedTypes = ["visitor", "page_view", "phone_click", "whatsapp_click", "time_spent", "view_contact", "contact_click"];
      finalEvents = events.filter((e) => allowedTypes.includes(e.eventType));
    } else if (tabsAllowed >= 3) {
      const allowedTypes = ["visitor", "page_view", "phone_click", "whatsapp_click"];
      finalEvents = events.filter((e) => allowedTypes.includes(e.eventType));
    }

    const visitors = events.filter((e) => e.eventType === "visitor" || e.eventType === "page_view").length;
    const phoneClicks = events.filter((e) => e.eventType === "phone_click").length;
    const whatsappClicks = events.filter((e) => e.eventType === "whatsapp_click").length;
    const totalViews = events.filter((e) => e.eventType === "page_view" || e.eventType === "visitor").length;

    const timeEvents = events.filter((e) => e.eventType === "time_spent" && e.durationSec > 0);
    let avgSec = 0;
    if (timeEvents.length > 0) {
      const sum = timeEvents.reduce((acc, curr) => acc + (curr.durationSec || 0), 0);
      avgSec = Math.round(sum / timeEvents.length);
    }
    const avgMinFormatted = avgSec > 0 ? (avgSec >= 60 ? `${Math.round(avgSec / 60)} min` : `${avgSec} sec`) : "0 min";

    const flatCounts = {};
    const cityCounts = {};
    events.forEach((e) => {
      if (e.flatUnit) flatCounts[e.flatUnit] = (flatCounts[e.flatUnit] || 0) + 1;
      if (e.city) cityCounts[e.city] = (cityCounts[e.city] || 0) + 1;
    });

    let mostViewedFlat = "N/A";
    let maxFlatCount = 0;
    Object.entries(flatCounts).forEach(([flat, count]) => {
      if (count > maxFlatCount) {
        maxFlatCount = count;
        mostViewedFlat = flat;
      }
    });

    let mostInterestedCity = "N/A";
    let maxCityCount = 0;
    Object.entries(cityCounts).forEach(([city, count]) => {
      if (count > maxCityCount) {
        maxCityCount = count;
        mostInterestedCity = city;
      }
    });

    // Populate restricted/masked object depending on subscription access level
    const resPayload = {
      visitorsCount: 0,
      phoneClickCount: 0,
      whatsAppClickCount: 0,
      propertiesViewsCount: 0,
      averageTimeMin: "0 min",
      mostViewedFlat: "🔒 Locked - Upgrade Required",
      mostInterestedCity: "🔒 Locked - Upgrade Required",
      events: finalEvents,
      analyticsAccess: tabsAllowed,
    };

    if (tabsAllowed >= 3) {
      resPayload.visitorsCount = visitors;
      resPayload.phoneClickCount = phoneClicks;
      resPayload.whatsAppClickCount = whatsappClicks;
    }
    if (tabsAllowed >= 5) {
      resPayload.propertiesViewsCount = totalViews;
      resPayload.averageTimeMin = avgMinFormatted;
    }
    if (tabsAllowed >= 7) {
      resPayload.mostViewedFlat = mostViewedFlat;
      resPayload.mostInterestedCity = mostInterestedCity;
    }

    return sendResponse(res, 200, true, "Analytics metrics fetched", resPayload);
  } catch (error) {
    console.error("Error fetching builder analytics:", error);
    return sendResponse(res, 500, false, error.message);
  }
};
