const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const Category = require("../models/Category");
const Product = require("../models/Product");

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, msg: "Admin token required" });

  jwt.verify(token, process.env.ADMIN_JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ success: false, msg: "Invalid admin token" });
    req.admin = payload;
    next();
  });
}

router.get("/categories", async (_req, res) => {
  try {
    const list = await Category.find().sort("name");
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

router.post("/categories", requireAdmin, async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ success: false, msg: "name is required" });
    const cat = await Category.create({ name });
    res.status(201).json({ success: true, data: cat });
  } catch (err) {
    res.status(err.code === 11000 ? 409 : 400).json({ success: false, msg: err.message });
  }
});

router.delete("/categories/:name", requireAdmin, async (req, res) => {
  const { name } = req.params;
  if (await Product.exists({ category: name })) {
    return res.status(409).json({ success: false, msg: `"${name}" is still assigned to products` });
  }
  const out = await Category.deleteOne({ name });
  if (!out.deletedCount) {
    return res.status(404).json({ success: false, msg: `"${name}" not found` });
  }
  res.json({ success: true, msg: `"${name}" removed` });
});

router.put("/products/:id/stock", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { stock } = req.body;
  if (typeof stock !== "number" || stock < 0) {
    return res.status(400).json({ success: false, msg: "Invalid stock value" });
  }
  try {
    const prod = await Product.findByIdAndUpdate(id, { stock });
    if (!prod) return res.status(404).json({ success: false, msg: "Product not found" });
    res.json({ success: true, data: prod });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

router.get("/products", requireAdmin, async (_req, res) => {
  try {
    const list = await Product.find();
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

router.post("/products", requireAdmin, async (req, res) => {
  try {
    const { name, category, color, description, stock, image1, image2, image3 } = req.body;

    if (!name?.trim() || !category || !image1 || !image2 || !image3) {
      return res.status(400).json({
        success: false,
        msg: "name, category and three image fields (image1-3) are required",
      });
    }

    const currentMax = await Product.maxProductId();
    const nextId = currentMax + 1;

    const prod = await Product.create({
      product_id: nextId,
      name: name.trim(),
      category,
      color,
      description,
      stock,
      image1, image2, image3,
      price: -1,
      averageRating: 0,
    });

    res.status(201).json({ success: true, data: prod });
  } catch (err) {
    res.status(err.code === 11000 ? 409 : 400).json({ success: false, msg: err.message });
  }
});

router.delete("/products/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const out = await Product.findByIdAndDelete(id);
    if (!out) return res.status(404).json({ success: false, msg: "Product not found" });
    res.json({ success: true, msg: "Product removed" });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

module.exports = router;
