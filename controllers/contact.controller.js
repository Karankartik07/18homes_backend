import Contact from "../models/contact.model.js";
import Property from "../models/property.model.js";
import sendResponse from "../utils/apiResponse.js";

/* ======================================================
   CREATE CONTACT (USER)
====================================================== */
export const createContact = async (req, res) => {
  try {
    const { propertyId, message } = req.body;

    if (!propertyId) {
      return sendResponse(res, 400, false, "Property ID is required");
    }

    const property = await Property.findById(propertyId).populate(
      "owner",
      "name email phone"
    );

    if (!property || !property.isActive || property.isFlagged) {
      return sendResponse(res, 404, false, "Property not found");
    }

    // ❌ Owner cannot contact own property
    if (property.owner._id.toString() === req.user._id.toString()) {
      return sendResponse(
        res,
        400,
        false,
        "You cannot contact your own property"
      );
    }

    // ❌ Prevent duplicate contact
    const alreadyContacted = await Contact.findOne({
      property: propertyId,
      buyer: req.user._id,
    });

    if (alreadyContacted) {
      return sendResponse(
        res,
        409,
        false,
        "You have already contacted for this property"
      );
    }

    const contact = await Contact.create({
      property: propertyId,
      buyer: req.user._id,
      owner: property.owner._id,
      message,
    });

    return sendResponse(res, 201, true, "Contact request sent successfully", {
      contact,
      ownerDetails: {
        name: property.owner.name,
        email: property.owner.email,
        phone: property.owner.phone,
      },
    });
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   GET MY CONTACTS (USER / ADMIN)
====================================================== */
export const getMyContacts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    // ================= ROLE BASED FILTER =================
    const roleFilter =
      req.user.role === "admin"
        ? {}
        : {
            $or: [
              { buyer: req.user._id },
              { owner: req.user._id },
            ],
          };

    // ================= SEARCH FILTER =================
    const searchFilter = search
      ? {
          message: { $regex: search, $options: "i" },
        }
      : {};

    const finalFilter = {
      ...roleFilter,
      ...searchFilter,
    };

    const [contacts, total] = await Promise.all([
      Contact.find(finalFilter)
        .populate({
          path: "property",
          select: "title price address images purpose propertyType",
        })
        .populate("buyer", "name email phone")
        .populate("owner", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Contact.countDocuments(finalFilter),
    ]);

    return sendResponse(res, 200, true, "Contacts fetched successfully", {
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};


/* ======================================================
   GET SINGLE CONTACT
====================================================== */
export const getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate({
        path: "property",
        select: "title price address images",
      })
      .populate("buyer", "name email phone")
      .populate("owner", "name email phone");

    if (!contact) {
      return sendResponse(res, 404, false, "Contact not found");
    }

    const isAuthorized =
      req.user.role === "admin" ||
      contact.buyer._id.toString() === req.user._id.toString() ||
      contact.owner._id.toString() === req.user._id.toString();

    if (!isAuthorized) {
      return sendResponse(res, 403, false, "Access denied");
    }

    return sendResponse(
      res,
      200,
      true,
      "Contact fetched successfully",
      contact
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   DELETE CONTACT
====================================================== */
export const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return sendResponse(res, 404, false, "Contact not found");
    }

    const canDelete =
      req.user.role === "admin" ||
      contact.buyer.toString() === req.user._id.toString();

    if (!canDelete) {
      return sendResponse(res, 403, false, "Access denied");
    }

    await contact.deleteOne();

    return sendResponse(res, 200, true, "Contact deleted successfully");
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};
