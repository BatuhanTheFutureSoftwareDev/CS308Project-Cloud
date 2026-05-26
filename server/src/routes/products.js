/* eslint-disable consistent-return */
const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

router.post("/add", async (req, res) => {
  const { product_id, name, price, color, category, stock, description } = req.body;

  if (!product_id || !name || !price || !category)
    return res.status(400).json({ success: false, error: "product_id, name, price ve category zorunludur." });

  try {
    const existing = await Product.findOne({ product_id });
    if (existing)
      return res.status(400).json({ success: false, error: "Bu ID ile bir ürün zaten var." });

    const newProduct = await Product.create({
      product_id, name, price, color, category, stock, description,
    });
    res.status(201).json({ success: true, message: "Ürün başarıyla eklendi.", data: newProduct });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/", async (_req, res) => {
  try {
    const products = await Product.find({ price: { $ne: -1 } });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sort", async (req, res) => {
  const { by, order } = req.query;
  const sortFields = { name: "name", price: "price", rating: "averageRating" };
  const sortBy = sortFields[by];
  const sortOrder = order === "desc" ? -1 : 1;

  if (!sortBy)
    return res.status(400).json({ success: false, error: "Geçerli bir sıralama kriteri girin (name, price, rating)" });

  try {
    const products = await Product
      .find({ price: { $ne: -1 } })
      .sort({ [sortBy]: sortOrder });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/search", async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ success: false, error: "Arama değeri gerekli." });

  try {
    const results = await Product.find({
      price: { $ne: -1 },
      $or: [
        { name: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } },
      ],
    });
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/categories", async (_req, res) => {
  try {
    const categories = await Product.distinct("category", { price: { $ne: -1 } });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.price === -1)
      return res.status(404).json({ success: false, error: "Product not found." });
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
