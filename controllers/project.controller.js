import Project from "../models/project.model.js";
import sendResponse from "../utils/apiResponse.js";

/* ======================================================
   1. CREATE PROJECT (BUILDER / DEALER / ADMIN)
====================================================== */
export const createProject = async (req, res) => {
  try {
    const {
      projectName,
      reraNumber,
      tagline,
      description,
      projectType,
      projectStatus,
      address,
      priceRange,
      configurations,
      amenities,
      images,
      masterPlanImage,
      brochureUrl,
      possessionDate,
    } = req.body;

    if (!projectName || !address?.city) {
      return sendResponse(
        res,
        400,
        false,
        "Project Name and City are required"
      );
    }

    const baseSlug = projectName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const slug = `${baseSlug}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;

    const project = await Project.create({
      projectName: projectName.trim(),
      slug,
      builder: req.user._id,
      reraNumber: reraNumber || "",
      tagline: tagline || "",
      description: description || "",
      projectType: projectType || "residential",
      projectStatus: projectStatus || "under_construction",
      address: address || {},
      priceRange: priceRange || {},
      configurations: configurations || [],
      amenities: amenities || [],
      images: images || [],
      masterPlanImage: masterPlanImage || "",
      brochureUrl: brochureUrl || "",
      possessionDate: possessionDate ? new Date(possessionDate) : null,
    });

    const populatedProject = await Project.findById(project._id).populate(
      "builder",
      "name email phone builderDetails dealerDetails role"
    );

    return sendResponse(
      res,
      201,
      true,
      "Project listing created successfully",
      populatedProject
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   2. GET ALL PROJECTS (PUBLIC SEARCH WITH FILTERS)
====================================================== */
export const getProjects = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || "";
    const city = req.query.city || "";
    const projectType = req.query.projectType || "";
    const projectStatus = req.query.projectStatus || "";
    const minPrice = Number(req.query.minPrice) || 0;
    const maxPrice = Number(req.query.maxPrice) || 0;
    const skip = (page - 1) * limit;

    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { projectName: { $regex: search, $options: "i" } },
        { reraNumber: { $regex: search, $options: "i" } },
        { "address.locality": { $regex: search, $options: "i" } },
        { "address.city": { $regex: search, $options: "i" } },
      ];
    }

    if (city) {
      filter["address.city"] = { $regex: city, $options: "i" };
    }

    if (projectType) {
      filter.projectType = projectType;
    }

    if (projectStatus) {
      filter.projectStatus = projectStatus;
    }

    if (minPrice > 0) {
      filter["priceRange.minPrice"] = { $gte: minPrice };
    }

    if (maxPrice > 0) {
      filter["priceRange.maxPrice"] = { $lte: maxPrice };
    }

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .populate("builder", "name email phone builderDetails dealerDetails")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Project.countDocuments(filter),
    ]);

    return sendResponse(res, 200, true, "Projects fetched successfully", {
      projects,
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
   3. GET MY PROJECTS (LOGGED-IN BUILDER / DEALER)
====================================================== */
export const getMyProjects = async (req, res) => {
  try {
    const filter =
      req.user.role === "admin"
        ? {}
        : { builder: req.user._id };

    const projects = await Project.find(filter)
      .populate("builder", "name email phone builderDetails dealerDetails")
      .sort({ createdAt: -1 });

    return sendResponse(
      res,
      200,
      true,
      "My projects fetched successfully",
      projects
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   4. GET SINGLE PROJECT BY ID
====================================================== */
export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate(
      "builder",
      "name email phone builderDetails dealerDetails role"
    );

    if (!project) {
      return sendResponse(res, 404, false, "Project not found");
    }

    // Increment view count
    project.viewCount = (project.viewCount || 0) + 1;
    await project.save();

    return sendResponse(
      res,
      200,
      true,
      "Project fetched successfully",
      project
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   5. UPDATE PROJECT BY ID
====================================================== */
export const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return sendResponse(res, 404, false, "Project not found");
    }

    const isOwner =
      req.user.role === "admin" ||
      project.builder.toString() === req.user._id.toString();

    if (!isOwner) {
      return sendResponse(
        res,
        403,
        false,
        "Access denied to modify this project"
      );
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate("builder", "name email phone builderDetails dealerDetails");

    return sendResponse(
      res,
      200,
      true,
      "Project updated successfully",
      updatedProject
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   6. DELETE PROJECT BY ID
====================================================== */
export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return sendResponse(res, 404, false, "Project not found");
    }

    const canDelete =
      req.user.role === "admin" ||
      project.builder.toString() === req.user._id.toString();

    if (!canDelete) {
      return sendResponse(res, 403, false, "Access denied to delete project");
    }

    await project.deleteOne();

    return sendResponse(res, 200, true, "Project deleted successfully");
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};
