const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

router.put("/:productId", async (req, res) => {
  const { productId } = req.params;
  const { discountAmount } = req.body;

  if (!discountAmount || isNaN(discountAmount) || discountAmount <= 0 || discountAmount >= 100) {
    return res.status(400).json({ success: false, msg: "Discount must be between 1 and 99 percent" });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, msg: "Product not found" });
    if (product.discountAmount) {
      return res.status(400).json({ success: false, msg: "Discount already applied" });
    }

    const discountPercentage = discountAmount / 100;
    const newPrice = product.price - product.price * discountPercentage;

    product.discountedPrice = newPrice;
    product.discountAmount = discountAmount;
    await product.save();

    res.json({ success: true, msg: "Discount applied successfully", data: product });
  } catch (err) {
    console.error("Error applying discount:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

router.put("/remove/:productId", async (req, res) => {
  const { productId } = req.params;

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, msg: "Product not found" });
    if (!product.discountAmount) {
      return res.status(400).json({ success: false, msg: "No discount to remove" });
    }

    product.discountedPrice = null;
    product.discountAmount = null;
    await product.save();

    res.json({ success: true, msg: "Discount removed successfully", data: product });
  } catch (err) {
    console.error("Error removing discount:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

module.exports = router;
