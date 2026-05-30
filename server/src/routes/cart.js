const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart");
const User = require("../models/User");
const Product = require("../models/Product");
const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, error: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: "Invalid token" });
    req.user = user;
    next();
  });
}

router.get("/user/address", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const address = user.address?.trim();
    if (!address) {
      return res.status(200).json({
        success: true,
        address: null,
        message: "Address is missing. Please update your address in the profile page.",
      });
    }
    res.json({ success: true, address });
  } catch (error) {
    console.error("Error checking address:", error);
    res.status(500).json({ success: false, error: "Server error while checking address." });
  }
});

router.post("/merge", authenticateToken, async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, error: "Cart items must be an array." });
  }

  try {
    for (const item of items) {
      const { productId, quantity, orderId } = item;
      if (!productId) continue;

      const existing = await Cart.findOne({ userId: req.user.id, productId });
      if (existing) {
        existing.quantity = (existing.quantity || 0) + (quantity || 1);
        if (orderId) existing.orderId = orderId;
        // Backfill price snapshot if missing on the existing row.
        if (typeof existing.price !== "number" || Number.isNaN(existing.price)) {
          const product = await Product.findById(productId);
          if (product) {
            existing.price = product.price;
            existing.discountedPrice = product.discountedPrice || null;
            existing.discountAmount = product.discountAmount || null;
          }
        }
        await existing.save();
      } else {
        const product = await Product.findById(productId);
        if (!product) continue; // skip merged rows referencing deleted products
        await new Cart({
          userId: req.user.id,
          productId,
          quantity: quantity || 1,
          orderId: orderId || undefined,
          price: product.price,
          discountedPrice: product.discountedPrice || null,
          discountAmount: product.discountAmount || null,
        }).save();
      }
    }
    res.json({ success: true, message: "Cart successfully merged." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/add", authenticateToken, async (req, res) => {
  const { productId, quantity, orderId, setQuantity } = req.body;
  if (!productId) return res.status(400).json({ success: false, error: "Product ID is required." });

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, error: "Product not found." });

    const existing = await Cart.findOne({ userId: req.user.id, productId });

    if (existing) {
      if (setQuantity) {
        existing.quantity = quantity || 1;
      } else {
        existing.quantity = (existing.quantity || 0) + (quantity || 1);
      }
      if (orderId) existing.orderId = orderId;
      await existing.save();
      return res.json({ success: true, message: "Cart updated." });
    }

    await new Cart({
      userId: req.user.id,
      productId,
      quantity: quantity || 1,
      orderId: orderId || undefined,
      price: product.price,
      discountedPrice: product.discountedPrice || null,
      discountAmount: product.discountAmount || null,
    }).save();

    res.status(201).json({ success: true, message: "Product added to cart." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const items = await Cart.find({ userId: req.user.id }).populate("productId");
    const transformedItems = items.map((item) => {
      const flat = { ...item };
      const product = item.productId && typeof item.productId === "object" ? { ...item.productId } : null;
      if (product) {
        product.price = item.price;
        product.discountedPrice = item.discountedPrice;
        product.discountAmount = item.discountAmount;
      }
      flat.productId = product || item.productId;
      return flat;
    });
    res.json({ success: true, data: transformedItems });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/:productId", authenticateToken, async (req, res) => {
  try {
    await Cart.findOneAndDelete({ userId: req.user.id, productId: req.params.productId });
    res.json({ success: true, message: "Product removed from cart." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
