require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ping } = require("./config");

const app = express();

ping().catch(() => {});

// In the two-container topology the frontend nginx proxies same-origin to us
// (no CORS needed for browser → frontend). cors() stays as a safety net for
// direct browser calls during local dev and any future case where another
// origin needs to reach the backend ALB.
app.use(cors());

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.use("/auth", require("./routes/auth"));
app.use("/products", require("./routes/products"));
app.use("/reviews", require("./routes/reviews"));
app.use("/cart", require("./routes/cart"));
app.use("/purchase", require("./routes/purchase"));
app.use("/api/refund", require("./routes/refund"));
app.use("/productmanager", require("./routes/productmanager"));
app.use("/salesmanager", require("./routes/salesmanager"));
app.use("/wishlist", require("./routes/wishlist"));
app.use("/user", require("./routes/profile"));
app.use("/apply-discount", require("./routes/applyDiscount"));

// Health endpoint hit by the internal ALB target group.
app.get("/healthz", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 5001;
app.listen(port, "0.0.0.0", () => {
  console.log(`Backend API listening on port ${port}`);
});
