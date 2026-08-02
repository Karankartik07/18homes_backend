import FeaturedAd from "../models/featuredAd.model.js";
import Property from "../models/property.model.js";
import sendResponse from "../utils/apiResponse.js";

/* ======================================================
   1. CREATE FEATURED AD CAMPAIGN (DEALER / BUILDER / ADMIN)
====================================================== */
export const createFeaturedAd = async (req, res) => {
  try {
    const { city, locality, tagline, adPackage } = req.body;

    if (!city || !city.trim()) {
      return sendResponse(res, 400, false, "City is required for featured ad");
    }

    const selectedPackage = adPackage || "pro_30_days";
    let durationDays = 30;
    if (selectedPackage === "starter_7_days") durationDays = 7;
    if (selectedPackage === "premium_90_days") durationDays = 90;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + durationDays);

    const featuredAd = await FeaturedAd.create({
      dealer: req.user._id,
      city: city.trim(),
      locality: locality ? locality.trim() : "",
      tagline: tagline ? tagline.trim() : "Top Area Specialist & Verified Dealer",
      adPackage: selectedPackage,
      startDate,
      endDate,
      status: "active",
    });

    const populatedAd = await FeaturedAd.findById(featuredAd._id).populate(
      "dealer",
      "name email phone role avatar dealerDetails builderDetails"
    );

    return sendResponse(
      res,
      201,
      true,
      "Featured Agent Ad campaign activated successfully",
      populatedAd
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   2. GET MY FEATURED ADS (DEALER / BUILDER)
====================================================== */
export const getMyFeaturedAds = async (req, res) => {
  try {
    const filter =
      req.user.role === "admin"
        ? {}
        : { dealer: req.user._id };

    const ads = await FeaturedAd.find(filter)
      .populate("dealer", "name email phone role avatar dealerDetails builderDetails")
      .sort({ createdAt: -1 });

    return sendResponse(
      res,
      200,
      true,
      "Featured ad campaigns fetched successfully",
      ads
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   3. GET FEATURED AGENTS BY LOCALITY (PUBLIC API)
====================================================== */
export const getFeaturedAgentsByLocality = async (req, res) => {
  try {
    const city = req.query.city || "";
    const locality = req.query.locality || "";

    const query = {
      status: "active",
      endDate: { $gte: new Date() },
    };

    if (city) {
      query.city = { $regex: city, $options: "i" };
    }

    if (locality) {
      query.$or = [
        { locality: { $regex: locality, $options: "i" } },
        { locality: "" },
      ];
    }

    const featuredAds = await FeaturedAd.find(query)
      .populate("dealer", "name email phone role avatar dealerDetails builderDetails isVerified")
      .sort({ createdAt: -1 })
      .limit(10);

    // Populate active properties count for each dealer
    const agentsWithStats = await Promise.all(
      featuredAds.map(async (ad) => {
        const adObj = ad.toObject();
        if (adObj.dealer?._id) {
          const propertyCount = await Property.countDocuments({
            owner: adObj.dealer._id,
            isActive: true,
          });
          adObj.activePropertyCount = propertyCount;
        }
        return adObj;
      })
    );

    return sendResponse(
      res,
      200,
      true,
      "Featured agents fetched successfully",
      agentsWithStats
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   4. GET ALL FEATURED ADS (ADMIN MANAGER)
====================================================== */
export const getAllFeaturedAdsAdmin = async (req, res) => {
  try {
    const ads = await FeaturedAd.find()
      .populate("dealer", "name email phone role avatar dealerDetails builderDetails")
      .sort({ createdAt: -1 });

    return sendResponse(
      res,
      200,
      true,
      "Admin featured ads fetched successfully",
      ads
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   5. UPDATE FEATURED AD STATUS (ADMIN / DEALER)
====================================================== */
export const updateFeaturedAdStatus = async (req, res) => {
  try {
    const { status, extendDays } = req.body;
    const ad = await FeaturedAd.findById(req.params.id);

    if (!ad) {
      return sendResponse(res, 404, false, "Featured Ad not found");
    }

    if (status) ad.status = status;

    if (extendDays && Number(extendDays) > 0) {
      const currentEnd = new Date(ad.endDate);
      currentEnd.setDate(currentEnd.getDate() + Number(extendDays));
      ad.endDate = currentEnd;
      ad.status = "active";
    }

    await ad.save();

    const updatedAd = await FeaturedAd.findById(ad._id).populate(
      "dealer",
      "name email phone role avatar dealerDetails builderDetails"
    );

    return sendResponse(
      res,
      200,
      true,
      "Featured Ad updated successfully",
      updatedAd
    );
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   6. DELETE FEATURED AD (DEALER / ADMIN)
====================================================== */
export const deleteFeaturedAd = async (req, res) => {
  try {
    const ad = await FeaturedAd.findById(req.params.id);

    if (!ad) {
      return sendResponse(res, 404, false, "Featured Ad not found");
    }

    const canDelete =
      req.user.role === "admin" ||
      ad.dealer.toString() === req.user._id.toString();

    if (!canDelete) {
      return sendResponse(res, 403, false, "Access denied to delete ad");
    }

    await ad.deleteOne();

    return sendResponse(res, 200, true, "Featured Ad deleted successfully");
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};
