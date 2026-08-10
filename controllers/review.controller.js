import Review from "../models/review.model.js";
import Property from "../models/property.model.js";
import User from "../models/user.model.js";
import sendResponse from "../utils/apiResponse.js";

// Helper function to recalculate ratings for a property and its seller
const recalculateRatings = async (propertyId, sellerId) => {
  // 1. Property Ratings Calculation
  const propertyReviews = await Review.find({ property: propertyId });
  let propAvg = 5.0;
  let propTotal = propertyReviews.length;

  if (propTotal > 0) {
    const sum = propertyReviews.reduce((acc, r) => acc + r.rating, 0);
    propAvg = Number((sum / propTotal).toFixed(1));
  }

  await Property.findByIdAndUpdate(propertyId, {
    averageRating: propAvg,
    totalRatings: propTotal,
  });

  // 2. Seller / Owner Overall Ratings Calculation (across all their properties)
  const sellerReviews = await Review.find({ seller: sellerId });
  let sellerAvg = 5.0;
  let sellerTotal = sellerReviews.length;

  if (sellerTotal > 0) {
    const sellerSum = sellerReviews.reduce((acc, r) => acc + r.rating, 0);
    sellerAvg = Number((sellerSum / sellerTotal).toFixed(1));
  }

  await User.findByIdAndUpdate(sellerId, {
    averageRating: sellerAvg,
    totalRatings: sellerTotal,
  });

  return { propAvg, propTotal, sellerAvg, sellerTotal };
};

/* ======================================================
   ADD OR UPDATE REVIEW (USER)
====================================================== */
export const addOrUpdateReview = async (req, res) => {
  try {
    const { propertyId, rating, comment } = req.body;
    const userId = req.user._id;

    if (!propertyId || !rating) {
      return sendResponse(res, 400, false, "Property ID and rating are required");
    }

    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return sendResponse(res, 400, false, "Rating must be a number between 1 and 5");
    }

    const property = await Property.findById(propertyId);
    if (!property || !property.isActive) {
      return sendResponse(res, 404, false, "Property not found or inactive");
    }

    // Owner cannot rate their own property
    if (property.owner.toString() === userId.toString()) {
      return sendResponse(res, 400, false, "You cannot rate your own property");
    }

    // Find existing review or create new
    let review = await Review.findOne({ property: propertyId, user: userId });

    if (review) {
      review.rating = numRating;
      review.comment = comment !== undefined ? comment : review.comment;
      await review.save();
    } else {
      review = await Review.create({
        property: propertyId,
        seller: property.owner,
        user: userId,
        rating: numRating,
        comment: comment || "",
      });
    }

    // Recalculate average ratings
    const stats = await recalculateRatings(property._id, property.owner);

    return sendResponse(res, 200, true, "Review submitted successfully", {
      review,
      propertyAverageRating: stats.propAvg,
      propertyTotalRatings: stats.propTotal,
    });
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   GET PROPERTY REVIEWS (PUBLIC)
====================================================== */
export const getPropertyReviews = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const property = await Property.findById(propertyId).select("averageRating totalRatings owner");
    if (!property) {
      return sendResponse(res, 404, false, "Property not found");
    }

    const reviews = await Review.find({ property: propertyId })
      .populate("user", "name avatar role")
      .sort({ createdAt: -1 });

    let myReview = null;
    if (req.user) {
      myReview = reviews.find((r) => r.user._id.toString() === req.user._id.toString()) || null;
    }

    return sendResponse(res, 200, true, "Reviews fetched successfully", {
      reviews,
      averageRating: property.averageRating,
      totalRatings: property.totalRatings,
      myReview,
    });
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};

/* ======================================================
   DELETE REVIEW (USER / ADMIN)
====================================================== */
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findById(reviewId);

    if (!review) {
      return sendResponse(res, 404, false, "Review not found");
    }

    if (review.user.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return sendResponse(res, 403, false, "Not authorized to delete this review");
    }

    const propertyId = review.property;
    const sellerId = review.seller;

    await review.deleteOne();

    // Recalculate ratings after deletion
    await recalculateRatings(propertyId, sellerId);

    return sendResponse(res, 200, true, "Review deleted successfully");
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
};
