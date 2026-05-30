const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

const Purchase = require("../models/Purchase");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const User = require("../models/User");

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, msg: "Admin token required" });

  jwt.verify(token, process.env.SALES_ADMIN_JWT_SECRET, (err, payload) => {
    if (!err) { req.salesAdmin = payload; return next(); }

    jwt.verify(token, process.env.ADMIN_JWT_SECRET, (adErr, adPayload) => {
      if (adErr) return res.status(403).json({ success: false, msg: "Invalid admin token" });
      req.admin = adPayload;
      next();
    });
  });
}

function authenticateToken(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, error: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: "Invalid token" });
    req.user = user;
    next();
  });
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

function buildReceiptPDF({ orderId, items, overallTotal, purchaseDate = Date.now() }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const bufs = [];
      doc.on("data", (d) => bufs.push(d));
      doc.on("end", () => resolve(Buffer.concat(bufs)));

      doc.fontSize(26).text("SwagLab", { align: "center" }).moveDown();
      const dateStr = new Date(purchaseDate).toLocaleDateString("tr-TR");
      doc.fontSize(12).text(dateStr, { align: "right" }).moveDown(1.5);
      doc.text(`Order Number: ${orderId}`).moveDown();

      items.forEach((it) => {
        doc.font("Helvetica-Bold").text(it.name);
        doc.font("Helvetica").text(it.code || "");

        let effectivePrice = null;
        if (typeof it.discountedPrice === "number") effectivePrice = it.discountedPrice;
        else if (typeof it.originalPrice === "number") effectivePrice = it.originalPrice;
        else if (typeof it.lineTotal === "number" && it.quantity) effectivePrice = it.lineTotal / it.quantity;
        else if (typeof it.totalPrice === "number" && it.quantity) effectivePrice = it.totalPrice / it.quantity;
        else if (it.productId && typeof it.productId.price === "number") effectivePrice = it.productId.price;
        else effectivePrice = 0;

        if (typeof it.discountedPrice === "number" && typeof it.discountAmount === "number") {
          doc.font("Helvetica").text(`Original Price: ${Number(it.originalPrice).toFixed(2)} EUR`);
          doc.font("Helvetica-Bold").text(
            `Discounted Price: ${Number(it.discountedPrice).toFixed(2)} EUR (${it.discountAmount}% off)`,
            { color: "#e74c3c" }
          );
        } else if (typeof it.originalPrice === "number") {
          doc.font("Helvetica").text(`Price: ${Number(it.originalPrice).toFixed(2)} EUR`);
        } else {
          doc.font("Helvetica").text(`Price: ${Number(effectivePrice).toFixed(2)} EUR`);
        }

        doc.moveUp().text(`${it.quantity} × ${Number(effectivePrice).toFixed(2)} EUR`, { align: "right" });
        doc.moveDown();
      });

      doc.moveDown();
      doc.font("Helvetica-Bold").text("TOTAL", { align: "right" });
      doc.text(`${overallTotal.toFixed(2)} EUR`, { align: "right" });

      doc.end();
    } catch (e) { reject(e); }
  });
}

router.post("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const cartItems = await Cart.find({ userId }).populate("productId");
    if (!cartItems.length) return res.status(400).json({ success: false, error: "Cart is empty." });

    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const receiptItems = [];
    let overallTotal = 0;

    for (const item of cartItems) {
      const p = item.productId;
      if (!p || p.stock < item.quantity) {
        return res.status(400).json({ success: false, error: `Insufficient stock for ${p?.name || "a product"}` });
      }

      p.stock -= item.quantity;
      await Product.findByIdAndUpdate(p.id, { stock: p.stock });

      // Fall back to the populated product's current pricing when the cart
      // row was created without a price snapshot (e.g. via /cart/merge).
      const originalPrice = Number(
        (typeof item.price === "number" && !Number.isNaN(item.price)) ? item.price
        : (typeof p.price === "number" && p.price >= 0 ? p.price : 0)
      );
      const discountedPrice =
        (typeof item.discountedPrice === "number" && !Number.isNaN(item.discountedPrice)) ? item.discountedPrice
        : (typeof p.discountedPrice === "number" ? p.discountedPrice : null);
      const discountAmount =
        (typeof item.discountAmount === "number" && !Number.isNaN(item.discountAmount)) ? item.discountAmount
        : (typeof p.discountAmount === "number" ? p.discountAmount : null);

      const effectivePrice = (typeof discountedPrice === "number" && discountedPrice > 0) ? discountedPrice : originalPrice;
      const quantity = Number(item.quantity) || 1;
      const lineTotal = Number((quantity * effectivePrice).toFixed(2));

      if (!Number.isFinite(lineTotal)) {
        return res.status(400).json({ success: false, error: `Could not compute price for ${p?.name || "a product"}` });
      }

      overallTotal += lineTotal;

      await new Purchase({
        userId,
        productId: p.id,
        quantity,
        totalPrice: lineTotal,
        originalPrice,
        ...(discountedPrice != null && {
          discountedPrice,
          discountAmount,
        }),
        status: "processing",
        orderId,
      }).save();

      receiptItems.push({
        name: p.name,
        code: p.barcode || p.id,
        quantity,
        originalPrice,
        ...(discountedPrice != null && {
          discountedPrice,
          discountAmount,
        }),
        lineTotal,
      });
    }

    await Cart.deleteMany({ userId });

    const user = await User.findById(userId);
    if (user?.mail_adress && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const pdfBuf = await buildReceiptPDF({ orderId, items: receiptItems, overallTotal });
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.mail_adress,
          subject: "Your SwagLab Receipt",
          text: "Thank you for your order! The receipt is attached.",
          attachments: [{ filename: `receipt_${orderId}.pdf`, content: pdfBuf }],
        });
        console.log("Receipt e-mailed to", user.mail_adress);
      } catch (mailErr) {
        console.warn("Email send failed:", mailErr.message);
      }
    }

    res.status(201).json({ success: true, message: "Order placed successfully.", orderId });
  } catch (e) {
    console.error("Error in POST /purchase:", e);
    res.status(500).json({ success: false, error: `Server error: ${e.message}` });
  }
});

router.get("/user", authenticateToken, async (req, res) => {
  try {
    const purchases = await Purchase
      .find({ userId: req.user.id })
      .populate("productId")
      .sort({ purchaseDate: -1 });
    res.json({ success: true, userId: req.user.id, data: purchases });
  } catch (e) {
    console.error("Error fetching purchases:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/receipt/:orderId", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const purchases = await Purchase
      .find({ userId: req.user.id, orderId })
      .populate("productId");

    if (!purchases.length) return res.status(404).json({ success: false, error: "Order not found." });

    const items = purchases.map((p) => ({
      name: p.productId?.name,
      code: p.productId?.barcode || p.productId?.id,
      quantity: p.quantity,
      originalPrice: p.originalPrice,
      ...(p.discountedPrice && {
        discountedPrice: p.discountedPrice,
        discountAmount: p.discountAmount,
      }),
      lineTotal: p.totalPrice,
    }));
    const overallTotal = items.reduce((t, i) => t + i.lineTotal, 0);
    const pdfBase64 = (await buildReceiptPDF({ orderId, items, overallTotal })).toString("base64");

    res.json({ success: true, pdfBase64 });
  } catch (e) {
    console.error("Error in GET /purchase/receipt:", e);
    res.status(500).json({ success: false, error: `Server error: ${e.message}` });
  }
});

router.get("/all", requireAdmin, async (req, res) => {
  try {
    const purchases = await Purchase
      .find()
      .populate("productId userId")
      .sort({ purchaseDate: -1 });
    res.json({ success: true, data: purchases });
  } catch (e) {
    console.error("Error fetching all purchases:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/metrics", requireAdmin, async (req, res) => {
  try {
    const { granularity = "month", start, end } = req.query;

    const match = {};
    if (start) match.purchaseDate = { ...match.purchaseDate, $gte: new Date(start).toISOString() };
    if (end) match.purchaseDate = { ...match.purchaseDate, $lte: new Date(end).toISOString() };

    const purchases = await Purchase.find(match).populate("productId");

    const makeLabel = (d) => {
      const date = new Date(d);
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(date.getUTCDate()).padStart(2, "0");
      if (granularity === "day") return `${y}-${m}-${dd}`;
      if (granularity === "year") return `${y}`;
      return `${y}-${m}`;
    };

    const grouped = {};
    purchases.forEach((p) => {
      const label = makeLabel(p.purchaseDate);
      const revenue = Number(p.totalPrice) || 0;
      const unitPrice = Number(p.productId?.price) || 0;
      const cost = 0.5 * unitPrice * p.quantity;
      const profit = revenue - cost;

      grouped[label] ??= { revenue: 0, profit: 0 };
      grouped[label].revenue += revenue;
      grouped[label].profit += profit;
    });

    const data = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, { revenue, profit }]) => ({
        label,
        revenue: Number(revenue.toFixed(2)),
        profit: Number(profit.toFixed(2)),
      }));

    res.json({ success: true, data });
  } catch (err) {
    console.error("Error aggregating metrics:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch("/:id/status", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !["processing", "in-transit", "delivered"].includes(status)) {
    return res.status(400).json({ success: false, error: "Invalid status value." });
  }
  try {
    const updated = await Purchase.findByIdAndUpdate(id, { status });
    if (!updated) return res.status(404).json({ success: false, error: "Purchase not found." });
    res.json({ success: true, data: updated });
  } catch (e) {
    console.error("Error updating purchase status:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete("/:id/cancel", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const purchase = await Purchase.findById(id);
    if (!purchase) return res.status(404).json({ success: false, error: "Purchase not found." });

    if (purchase.status !== "processing") {
      return res.status(400).json({ success: false, error: "Only products in 'processing' status can be canceled." });
    }
    if (String(purchase.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, error: "You are not authorized to cancel this purchase." });
    }

    const product = await Product.findById(purchase.productId);
    if (product) {
      await Product.findByIdAndUpdate(product.id, { stock: (product.stock || 0) + purchase.quantity });
    }
    await Purchase.findByIdAndDelete(id);

    res.json({ success: true, message: "Product successfully canceled." });
  } catch (e) {
    console.error("Error canceling purchase:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/:id/refund", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const purchase = await Purchase.findById(id);
    if (!purchase) return res.status(404).json({ success: false, error: "Purchase not found." });

    if (purchase.status !== "delivered") {
      return res.status(400).json({ success: false, error: "Only delivered products can be refunded." });
    }
    if (String(purchase.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, error: "You are not authorized to request a refund for this purchase." });
    }

    const deliveryDate = new Date(purchase.purchaseDate);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (deliveryDate < thirtyDaysAgo) {
      return res.status(400).json({ success: false, error: "Refund can only be requested within 30 days of delivery." });
    }

    purchase.refundStatus = "requested";
    purchase.refundRequestDate = new Date().toISOString();
    await purchase.save();

    res.json({ success: true, message: "Refund request submitted successfully." });
  } catch (e) {
    console.error("Error requesting refund:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/:id/approve-refund", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const purchase = await Purchase.findById(id);
    if (!purchase) return res.status(404).json({ success: false, error: "Purchase not found." });
    if (purchase.refundStatus !== "requested") {
      return res.status(400).json({ success: false, error: "This purchase does not have a pending refund request." });
    }

    const product = await Product.findById(purchase.productId);
    if (product) {
      await Product.findByIdAndUpdate(product.id, { stock: (product.stock || 0) + purchase.quantity });
    }

    await Purchase.findByIdAndDelete(id);

    const user = await User.findById(purchase.userId);
    if (user?.mail_adress && process.env.EMAIL_USER) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.mail_adress,
          subject: "Your Refund Request Has Been Approved",
          text: `Your refund request for order ${purchase.orderId} has been approved. The refund amount of ${purchase.totalPrice} EUR will be processed shortly.`,
        });
      } catch (e) { console.warn("Email failed:", e.message); }
    }

    res.json({ success: true, message: "Refund approved and purchase deleted." });
  } catch (e) {
    console.error("Error approving refund:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/:id/reject-refund", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const purchase = await Purchase.findById(id);
    if (!purchase) return res.status(404).json({ success: false, error: "Purchase not found." });
    if (purchase.refundStatus !== "requested") {
      return res.status(400).json({ success: false, error: "This purchase does not have a pending refund request." });
    }

    purchase.refundStatus = "rejected";
    await purchase.save();

    const user = await User.findById(purchase.userId);
    if (user?.mail_adress && process.env.EMAIL_USER) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.mail_adress,
          subject: "Your Refund Request Has Been Rejected",
          text: `Your refund request for order ${purchase.orderId} has been rejected. If you have any questions, please contact our customer service.`,
        });
      } catch (e) { console.warn("Email failed:", e.message); }
    }

    res.json({ success: true, message: "Refund request rejected." });
  } catch (e) {
    console.error("Error rejecting refund:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/admin/receipt/:orderId", requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const purchases = await Purchase.find({ orderId }).populate("productId");
    if (!purchases.length) return res.status(404).json({ success: false, error: "Order not found." });

    const purchaseDate = purchases[0].purchaseDate;
    const items = purchases.map((p) => ({
      name: p.productId?.name,
      code: p.productId?.barcode || p.productId?.id,
      quantity: p.quantity,
      originalPrice: p.originalPrice,
      ...(p.discountedPrice && {
        discountedPrice: p.discountedPrice,
        discountAmount: p.discountAmount,
      }),
      lineTotal: p.totalPrice,
    }));
    const overallTotal = items.reduce((t, i) => t + i.lineTotal, 0);

    const pdfBase64 = (await buildReceiptPDF({ orderId, items, overallTotal, purchaseDate })).toString("base64");
    res.json({ success: true, pdfBase64 });
  } catch (e) {
    console.error("Error in GET /purchase/admin/receipt:", e);
    res.status(500).json({ success: false, error: `Server error: ${e.message}` });
  }
});

module.exports = router;
