const express = require("express");
const router = express.Router();
const Wishlist = require("../models/Wishlist");
const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, error: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: "Invalid token" });
    req.user = user;
    next();
  });
}

router.get("/", authenticateToken, async (req, res) => {
  try {
    const items = await Wishlist.find({ userId: req.user.id }).populate("productId");
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/add", authenticateToken, async (req, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ success: false, error: "Product ID is required." });

  try {
    const existing = await Wishlist.findOne({ userId: req.user.id, productId });
    if (existing) return res.json({ success: true, message: "Already in wishlist" });

    await new Wishlist({ userId: req.user.id, productId }).save();
    res.status(201).json({ success: true, message: "Added to wishlist" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/:productId", authenticateToken, async (req, res) => {
  try {
    const result = await Wishlist.findOneAndDelete({
      userId: req.user.id,
      productId: req.params.productId,
    });
    if (!result) return res.status(404).json({ success: false, message: "Item not found in wishlist" });
    res.json({ success: true, message: "Removed from wishlist" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
