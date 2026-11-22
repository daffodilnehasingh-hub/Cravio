require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Order = require("./models/Order");
const app = require("./app");

const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
if (!process.env.JWT_SECRET) { console.error("JWT_SECRET is missing. Add it to backend/.env"); process.exit(1); }
const allowedOrigins = (process.env.CORS_ORIGIN || "http://127.0.0.1:5500,http://localhost:5500")
  .split(",").map(origin => origin.trim());
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
connectDB().then(() => {
  require("./services/paymentReconciliation").startPaymentReconciliation();
  server.listen(PORT, () => console.log(`Cravio API running at http://localhost:${PORT}`));
}).catch(error => { console.error("Database connection failed:", error.message); process.exit(1); });
