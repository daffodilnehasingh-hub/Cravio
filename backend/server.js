require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Order = require("./models/Order");
const authRoutes = require("./routes/authRoutes");
const addressRoutes = require("./routes/addressRoutes");
const orderRoutes = require("./routes/orderRoutes");
const studentVerificationRoutes = require("./routes/studentVerificationRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const favoriteRoutes = require("./routes/favoriteRoutes");
const supportRoutes = require("./routes/supportRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const couponRoutes = require("./routes/couponRoutes");
const outletRoutes = require("./routes/outletRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const deliveryPartnerRoutes = require("./routes/deliveryPartnerRoutes");
const adminCustomerRoutes = require("./routes/adminCustomerRoutes");
const errorHandler = require("./middleware/errorMiddleware");
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
if (!process.env.JWT_SECRET) { console.error("JWT_SECRET is missing. Add it to backend/.env"); process.exit(1); }
const allowedOrigins = (process.env.CORS_ORIGIN || "http://127.0.0.1:5500,http://localhost:5500")
  .split(",").map(origin => origin.trim());
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'", "https://checkout.razorpay.com"],
    frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
    connectSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
    imgSrc: ["'self'", "data:", "https:"], styleSrc: ["'self'", "'unsafe-inline'", "https:"]
  } }
}));
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error("This origin is not allowed by CORS."));
}}));
// Razorpay webhook signatures must be checked against the untouched raw bytes.
const { handleRazorpayWebhook } = require("./controllers/razorpayWebhookController");
app.post("/api/webhooks/razorpay", express.raw({ type: "application/json", limit: "1mb" }), handleRazorpayWebhook);
app.use(express.json({ limit: "10kb" }));
const io = new Server(server, { cors: { origin: allowedOrigins, methods: ["GET", "POST"] } });
app.set("io", io);
global.cravioIO = io;
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication required."));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id role managedOutletIds");
    if (!user) return next(new Error("Account not found."));
    socket.user = { id: String(user._id), role: user.role, managedOutletIds: user.managedOutletIds || [] };
    next();
  } catch (error) { next(new Error("Invalid session.")); }
});
io.on("connection", socket => {
  socket.on("order:join", async orderId => {
    if (typeof orderId !== "string" || !mongoose.isValidObjectId(orderId)) return;
    const order = await Order.findById(orderId).select("customer deliveryPartner outlet.outletId");
    if (!order) return;
    const u = socket.user;
    const allowed = String(order.customer) === u.id ||
      String(order.deliveryPartner || "") === u.id ||
      u.role === "admin" ||
      (u.role === "vendor" && (u.managedOutletIds || []).includes(order.outlet.outletId));
    if (allowed) socket.join(`order:${orderId}`);
  });
});
app.get("/api/health", (req, res) => res.json({ status: "ok", message: "Cravio API is running." }));

// B18: rate limiter on auth routes is handled inside authRoutes.js
// Keep a single limiter on /api/auth for backward compatibility
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false,
  message: { message: "Too many authentication attempts. Please try again later." } });
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/student-verification", studentVerificationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/outlets", outletRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/delivery-partners", deliveryPartnerRoutes);
app.use("/api/admin/customers", adminCustomerRoutes);
app.use(errorHandler);
connectDB().then(() => {
  require("./services/paymentReconciliation").startPaymentReconciliation();
  server.listen(PORT, () => console.log(`Cravio API running at http://localhost:${PORT}`));
}).catch(error => { console.error("Database connection failed:", error.message); process.exit(1); });
