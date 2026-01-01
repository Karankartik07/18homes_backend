import Property from "../models/property.model.js";
import User from "../models/user.model.js";
import sendResponse from "../utils/apiResponse.js";

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
      priceText,
      priceValue,
      area,
      bedrooms,
      bathrooms,
      furnishing,
      address,
      images,
    } = req.body;

    const property = await Property.create({
      title,
      description,
      purpose,
      propertyType,
      priceText, // "Two Hundred Rupees"
      priceValue, // 200 (optional but recommended)
      area,
      bedrooms,
      bathrooms,
      furnishing,
      address,
      images,
      owner: req.user._id,
      isActive: true,
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
    const {
      search,
      city,
      purpose,
      propertyType,
      minPrice,
      maxPrice,
      bedrooms,
      furnishing,
      page = 1,
      limit = 10,
      sort = "-createdAt",
    } = req.query;

    const query = {
      isActive: true,
      isFlagged: false,
    };

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
    if (bedrooms) query.bedrooms = Number(bedrooms);
    if (furnishing) query.furnishing = furnishing;

    // 🔥 PRICE FILTER (NUMERIC SAFE)
    if (minPrice || maxPrice) {
      query.priceValue = {};
      if (minPrice) query.priceValue.$gte = Number(minPrice);
      if (maxPrice) query.priceValue.$lte = Number(maxPrice);
    }

    const skip = (page - 1) * limit;

    const [properties, total] = await Promise.all([
      Property.find(query)
        .populate("owner", "name phone")
        .sort(sort)
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

    property.views += 1;
    await property.save();

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

    if (property.owner.toString() !== req.user._id.toString())
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
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        property[field] = req.body[field];
      }
    });

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
