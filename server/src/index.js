require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { ping } = require("./config");

const app = express();

ping().catch(() => {});

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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

app.get("/healthz", (_req, res) => res.json({ ok: true }));

const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/auth") || req.path.startsWith("/products") ||
      req.path.startsWith("/reviews") || req.path.startsWith("/cart") ||
      req.path.startsWith("/purchase") || req.path.startsWith("/api") ||
      req.path.startsWith("/productmanager") || req.path.startsWith("/salesmanager") ||
      req.path.startsWith("/wishlist") || req.path.startsWith("/user") ||
      req.path.startsWith("/apply-discount") || req.path.startsWith("/healthz")) {
    return next();
  }
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

const port = process.env.PORT || 5001;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
