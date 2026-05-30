const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const RefundRequest = require("../models/RefundRequest");
const Purchase = require("../models/Purchase");
const Product = require("../models/Product");
const User = require("../models/User");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, msg: "Admin token required" });

  jwt.verify(token, process.env.SALES_ADMIN_JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ success: false, msg: "Invalid admin token" });
    req.admin = payload;
    next();
  });
}

function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, error: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: "Invalid token" });
    req.user = user;
    next();
  });
}

router.post("/request", authenticateToken, async (req, res) => {
  try {
    const { purchaseId, reason } = req.body;
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) return res.status(404).json({ success: false, error: "Purchase not found" });
    if (!purchase.orderId) return res.status(400).json({ success: false, error: "Purchase is missing orderId" });

    if (String(purchase.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }
    if (purchase.status !== "delivered") {
      return res.status(400).json({ success: false, error: "Only delivered products can be refunded" });
    }

    const deliveryDate = new Date(purchase.purchaseDate);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (deliveryDate < thirtyDaysAgo) {
      return res.status(400).json({ success: false, error: "Refund can only be requested within 30 days of delivery" });
    }

    const existingRequest = await RefundRequest.findOne({ purchaseId, status: "pending" });
    if (existingRequest) {
      return res.status(400).json({ success: false, error: "A refund request is already pending for this purchase" });
    }

    await new RefundRequest({
      purchaseId,
      userId: req.user.id,
      productId: purchase.productId,
      orderId: purchase.orderId,
      quantity: purchase.quantity,
      totalPrice: purchase.totalPrice,
      reason,
    }).save();

    purchase.refundStatus = "requested";
    purchase.refundRequestDate = new Date().toISOString();
    await purchase.save();

    res.status(201).json({ success: true, message: "Refund request submitted successfully" });
  } catch (error) {
    console.error("Error creating refund request:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/all", requireAdmin, async (req, res) => {
  try {
    const requests = await RefundRequest
      .find()
      .populate("userId", "name mail_adress")
      .populate("productId", "name image1 price")
      .sort({ requestDate: -1 });
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error("Error fetching refund requests:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/user", authenticateToken, async (req, res) => {
  try {
    const requests = await RefundRequest
      .find({ userId: req.user.id })
      .populate("productId", "name image1 price")
      .sort({ requestDate: -1 });
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error("Error fetching user's refund requests:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const request = await RefundRequest.findById(id);
    if (!request) return res.status(404).json({ success: false, error: "Refund request not found" });
    if (request.status !== "pending") {
      return res.status(400).json({ success: false, error: "This request has already been processed" });
    }

    request.status = "approved";
    request.approvalDate = new Date().toISOString();
    request.adminNotes = adminNotes;
    await request.save();

    const purchase = await Purchase.findById(request.purchaseId);
    if (purchase) {
      purchase.refundStatus = "approved";
      purchase.status = "refunded";
      purchase.refundApprovalDate = new Date().toISOString();
      await purchase.save();

      const product = await Product.findById(request.productId);
      if (product) {
        await Product.findByIdAndUpdate(product.id, { stock: (product.stock || 0) + request.quantity });
      }
    }

    const user = await User.findById(request.userId);
    if (user?.mail_adress && process.env.EMAIL_USER) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.mail_adress,
          subject: "Your Refund Request Has Been Approved",
          text: `Your refund request for order ${request.orderId} has been approved. The refund amount of ${request.totalPrice} EUR will be processed shortly.`,
        });
      } catch (e) { console.warn("Email failed:", e.message); }
    }

    res.json({ success: true, message: "Refund request approved" });
  } catch (error) {
    console.error("Error approving refund request:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/:id/reject", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const request = await RefundRequest.findById(id);
    if (!request) return res.status(404).json({ success: false, error: "Refund request not found" });
    if (request.status !== "pending") {
      return res.status(400).json({ success: false, error: "This request has already been processed" });
    }

    request.status = "rejected";
    request.approvalDate = new Date().toISOString();
    request.adminNotes = adminNotes;
    await request.save();

    const purchase = await Purchase.findById(request.purchaseId);
    if (purchase) {
      purchase.refundStatus = "rejected";
      await purchase.save();
    }

    const user = await User.findById(request.userId);
    if (user?.mail_adress && process.env.EMAIL_USER) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.mail_adress,
          subject: "Your Refund Request Has Been Rejected",
          text: `Your refund request for order ${request.orderId} has been rejected. If you have any questions, please contact our customer service.`,
        });
      } catch (e) { console.warn("Email failed:", e.message); }
    }

    res.json({ success: true, message: "Refund request rejected" });
  } catch (error) {
    console.error("Error rejecting refund request:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
