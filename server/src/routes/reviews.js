const express = require("express");
const router = express.Router();
const Review = require("../models/Review");
const Product = require("../models/Product");
const Purchase = require("../models/Purchase");
const jwt = require("jsonwebtoken");
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;

function authenticateToken(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, error: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: "Invalid token" });
    req.user = user;
    next();
  });
}

function authenticateUserOrAdmin(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, error: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (!err) {
      req.user = user;
      req.isAdmin = false;
      return next();
    }
    jwt.verify(token, ADMIN_JWT_SECRET, (err2, admin) => {
      if (!err2) {
        req.user = admin;
        req.isAdmin = true;
        return next();
      }
      return res.status(403).json({ success: false, error: "Invalid token" });
    });
  });
}

router.post("/:productId", authenticateToken, async (req, res) => {
  const { rating, comment } = req.body;
  const { productId } = req.params;
  const trimmedComment = (comment || "").trim();

  if (!rating && !trimmedComment) {
    return res.status(400).json({ success: false, error: "At least a rating or comment is required." });
  }
  if (trimmedComment && (!rating || rating < 1 || rating > 5)) {
    return res.status(400).json({ success: false, error: "A valid rating is required to post a comment." });
  }

  try {
    const userPurchases = await Purchase.find({ userId: req.user.id });
    const hasPurchased = userPurchases.some((p) => String(p.productId) === String(productId));
    if (!hasPurchased) {
      return res.status(403).json({ success: false, error: "You can only review products you've purchased." });
    }

    const existing = await Review.findOne({ userId: req.user.id, productId });
    if (existing) {
      return res.status(400).json({ success: false, error: "You already reviewed this product." });
    }

    await new Review({
      userId: req.user.id,
      productId,
      rating,
      comment: trimmedComment,
      status: trimmedComment ? "pending" : "approved",
    }).save();

    const allReviews = await Review.find({ productId });
    const totalRating = allReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
    const average = allReviews.length ? totalRating / allReviews.length : 0;

    await Product.findByIdAndUpdate(productId, { averageRating: average });

    res.status(201).json({
      success: true,
      message: trimmedComment ? "Review submitted and awaiting approval." : "Review submitted and auto-approved.",
    });
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:productId", async (req, res) => {
  let isAdmin = false;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    try {
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, ADMIN_JWT_SECRET);
      isAdmin = true;
    } catch {}
  }
  try {
    const allReviews = await Review.find({ productId: req.params.productId });
    let response;
    if (isAdmin) {
      response = allReviews
        .filter((r) => r.comment && r.comment.trim() !== "")
        .map((r) => ({
          _id: r._id,
          rating: r.rating,
          comment: r.comment,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
    } else {
      response = allReviews.map((r) => ({
        _id: r._id,
        rating: r.rating,
        comment: r.status === "approved" ? r.comment : null,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    }
    res.json({ success: true, data: response });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/:id/approve", authenticateUserOrAdmin, async (req, res) => {
  try {
    await Review.findByIdAndUpdate(req.params.id, { status: "approved" });
    res.json({ success: true, message: "Review approved successfully." });
  } catch (error) {
    console.error("Error approving review:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/:id/decline", authenticateUserOrAdmin, async (req, res) => {
  try {
    await Review.findByIdAndUpdate(req.params.id, { status: "declined" });
    res.json({ success: true, message: "Review declined successfully." });
  } catch (error) {
    console.error("Error declining review:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
