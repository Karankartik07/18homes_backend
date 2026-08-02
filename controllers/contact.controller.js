import Contact from "../models/contact.model.js";
import Property from "../models/property.model.js";
import Project from "../models/project.model.js";
import sendResponse from "../utils/apiResponse.js";

/* ======================================================
   CREATE CONTACT (USER)
====================================================== */
export const createContact = async (req, res) => {
  try {
    const { propertyId, projectId, name, phone, email, message } = req.body;
    const targetId = projectId || propertyId;

    if (!targetId) {
      return sendResponse(res, 400, false, "Property or Project ID is required");
    }

    let ownerUser = null;
    let propDoc = null;
    let projDoc = null;

    // Check if it is a Property first
    propDoc = await Property.findById(targetId).populate("owner", "name email phone");
    if (propDoc && propDoc.isActive && !propDoc.isFlagged) {
      ownerUser = propDoc.owner;
    } else {
      // Check if it is a Project
      projDoc = await Project.findById(targetId).populate("builder", "name email phone");
      if (projDoc && projDoc.isActive) {
        ownerUser = projDoc.builder;
      }
    }

    if (!ownerUser) {
      return sendResponse(res, 404, false, "Property or Project not found");
    }

    // ❌ Owner/Builder cannot contact own listing
    if (ownerUser._id.toString() === req.user._id.toString()) {
      return sendResponse(
        res,
        400,
        false,
        "You cannot submit an inquiry for your own listing"
      );
    }

    // ❌ Prevent duplicate contact
    const duplicateQuery = { buyer: req.user._id };
    if (propDoc) duplicateQuery.property = propDoc._id;
    if (projDoc) duplicateQuery.project = projDoc._id;

    const alreadyContacted = await Contact.findOne(duplicateQuery);
    if (alreadyContacted) {
      return sendResponse(
        res,
        409,
        false,
        "You have already submitted an inquiry for this listing"
      );
    }

    const contactPayload = {
      buyer: req.user._id,
      owner: ownerUser._id,
      name: name || req.user.name,
      phone: phone || req.user.phone,
      email: email || req.user.email,
      message,
    };

    if (propDoc) contactPayload.property = propDoc._id;
    if (projDoc) contactPayload.project = projDoc._id;

    const contact = await Contact.create(contactPayload);

    return sendResponse(res, 201, true, "Contact request sent successfully", {
      contact,
      ownerDetails: {
        name: ownerUser.name,
        email: ownerUser.email,
        phone: ownerUser.phone,
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
        .populate({
          path: "project",
          select: "projectName priceRange address images projectStatus projectType",
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

/* ======================================================
   UPDATE CONTACT STATUS & ADD NOTE (OWNER / DEALER / ADMIN)
====================================================== */
export const updateContactStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return sendResponse(res, 404, false, "Contact lead not found");
    }

    const isAuthorized =
      req.user.role === "admin" ||
      contact.owner.toString() === req.user._id.toString() ||
      contact.buyer.toString() === req.user._id.toString();

    if (!isAuthorized) {
      return sendResponse(res, 403, false, "Access denied to update lead status");
    }

    if (status) {
      const validStatuses = ["new", "contacted", "site_visit", "closed"];
      if (!validStatuses.includes(status)) {
        return sendResponse(res, 400, false, "Invalid status value");
      }
      contact.status = status;
    }

    if (note && note.trim()) {
      contact.notes.push({ text: note.trim(), createdAt: new Date() });
    }

    await contact.save();

    const updatedContact = await Contact.findById(contact._id)
      .populate({
        path: "property",
        select: "title price address images purpose propertyType",
      })
      .populate("buyer", "name email phone")
      .populate("owner", "name email phone");

    return sendResponse(
      res,
      200,
      true,
      "Lead status updated successfully",
      updatedContact
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};
