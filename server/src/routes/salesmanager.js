const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const Product = require("../models/Product");

function requireSalesAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, msg: "Sales-admin token required" });

  jwt.verify(token, process.env.SALES_ADMIN_JWT_SECRET, (err, payload) => {
    if (!err) { req.salesAdmin = payload; return next(); }

    jwt.verify(token, process.env.ADMIN_JWT_SECRET, (adErr, adPayload) => {
      if (adErr) return res.status(403).json({ success: false, msg: "Invalid token" });
      req.admin = adPayload;
      next();
    });
  });
}

router.get("/pending-products", requireSalesAdmin, async (_req, res) => {
  try {
    const products = await Product.find({ price: -1 });
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

router.put("/products/:id/price", requireSalesAdmin, async (req, res) => {
  const { id } = req.params;
  const { price } = req.body;

  if (typeof price !== "number" || price <= 0) {
    return res.status(400).json({ success: false, msg: "Price must be a positive number" });
  }

  try {
    const product = await Product.findByIdAndUpdate(id, { price });
    if (!product) return res.status(404).json({ success: false, msg: "Product not found" });
    res.json({ success: true, data: product, msg: "Price updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

module.exports = router;
