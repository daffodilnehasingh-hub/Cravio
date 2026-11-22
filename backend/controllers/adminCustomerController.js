const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Order = require("../models/Order");

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

exports.listCustomers = async (req, res, next) => {
  try {
    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
    const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 20));
    const search = String(req.query.search || "").trim().slice(0, 100);
    const status = String(req.query.status || "all");
    const filter = { role: "customer" };
    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }
    const [customers, total] = await Promise.all([
      User.find(filter).select("name email phone isActive emailVerified isStudentVerified studentVerificationStatus createdAt")
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter)
    ]);
    const ids = customers.map(user => user._id);
    const orderStats = await Order.aggregate([
      { $match: { customer: { $in: ids }, status: { $ne: "payment_pending" } } },
      { $group: { _id: "$customer", orderCount: { $sum: 1 }, totalSpent: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, "$total", 0] } }, lastOrderAt: { $max: "$createdAt" } } }
    ]);
    const statsById = new Map(orderStats.map(stat => [String(stat._id), stat]));
    res.json({
      customers: customers.map(user => {
        const stats = statsById.get(String(user._id)) || {};
        return {
          id: String(user._id), name: user.name, email: user.email, phone: user.phone || "",
          isActive: user.isActive !== false, emailVerified: Boolean(user.emailVerified),
          isStudentVerified: Boolean(user.isStudentVerified),
          studentVerificationStatus: user.studentVerificationStatus || "not_submitted",
          createdAt: user.createdAt, orderCount: stats.orderCount || 0,
          totalSpent: Math.round((stats.totalSpent || 0) * 100) / 100,
          lastOrderAt: stats.lastOrderAt || null
        };
      }),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) { next(error); }
};

exports.getCustomerDetails = async (req, res, next) => {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: "customer" })
      .select("name email phone isActive emailVerified isStudentVerified studentVerificationStatus createdAt").lean();
    if (!customer) return res.status(404).json({ message: "Customer account not found." });
    const orders = await Order.find({ customer: customer._id, status: { $ne: "payment_pending" } })
      .select("orderNumber outlet items total status paymentStatus paymentMethod fulfillmentType createdAt")
      .sort({ createdAt: -1 }).limit(30).lean();
    const summary = orders.reduce((acc, order) => {
      acc.orders += 1;
      if (order.status !== "cancelled") acc.spent += Number(order.total || 0);
      return acc;
    }, { orders: 0, spent: 0 });
    res.json({
      customer: {
        id: String(customer._id), name: customer.name, email: customer.email, phone: customer.phone || "",
        isActive: customer.isActive !== false, emailVerified: Boolean(customer.emailVerified),
        isStudentVerified: Boolean(customer.isStudentVerified),
        studentVerificationStatus: customer.studentVerificationStatus || "not_submitted",
        createdAt: customer.createdAt
      },
      summary: { orders: summary.orders, totalSpent: Math.round(summary.spent * 100) / 100 },
      orders: orders.map(order => ({
        id: String(order._id), orderNumber: order.orderNumber, outletName: order.outlet?.name || "Outlet",
        items: (order.items || []).map(item => `${item.name} × ${item.quantity}`),
        total: order.total, status: order.status, paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod, fulfillmentType: order.fulfillmentType, createdAt: order.createdAt
      }))
    });
  } catch (error) { next(error); }
};

exports.updateCustomerStatus = async (req, res, next) => {
  try {
    const isActive = req.body.isActive;
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "Choose whether the customer account should be active." });
    }
    const customer = await User.findOneAndUpdate(
      { _id: req.params.id, role: "customer" },
      { $set: { isActive } },
      { new: true, runValidators: true }
    ).select("name email isActive");
    if (!customer) return res.status(404).json({ message: "Customer account not found." });
    res.json({ message: isActive ? "Customer account activated." : "Customer account deactivated.", customer });
  } catch (error) { next(error); }
};

// Admin creates an account with any role. Validation and password hashing
// mirror public registration exactly (same email regex, same bcrypt cost),
// except the account starts verified and active: public sign-ups verify via
// an emailed OTP, and SMTP is not configured yet, so admin-created accounts
// skip OTP and can sign in immediately.
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, phone, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: "Password must contain at least 8 characters." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }
    const userRole = role === undefined || role === "" ? "customer" : String(role);
    if (!["customer", "vendor", "delivery", "admin"].includes(userRole)) {
      return res.status(400).json({ message: "Choose a valid role: customer, vendor, delivery or admin." });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: phone ? String(phone).trim() : "",
      password: hashedPassword,
      role: userRole,
      emailVerified: true,
      isActive: true
    });
    res.status(201).json({
      message: `${userRole.charAt(0).toUpperCase() + userRole.slice(1)} account created for ${user.email}.`,
      user: {
        id: String(user._id), name: user.name, email: user.email, phone: user.phone || "",
        role: user.role, isActive: user.isActive !== false,
        emailVerified: Boolean(user.emailVerified), createdAt: user.createdAt
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    next(error);
  }
};

// Hard delete of any user account. Guards: an admin cannot delete their own
// account, and the last remaining admin account can never be deleted. Past
// orders keep their customer reference and outlet snapshot, and admin views
// already fall back gracefully for removed accounts.
exports.deleteUser = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "User account not found." });
    }
    const user = await User.findById(req.params.id).select("name email role");
    if (!user) return res.status(404).json({ message: "User account not found." });
    if (String(user._id) === String(req.user.id)) {
      return res.status(400).json({ message: "You cannot delete your own account." });
    }
    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return res.status(400).json({ message: "You cannot delete the last remaining admin account." });
      }
    }
    await user.deleteOne();
    res.json({
      message: `Account ${user.email} removed.`,
      user: { id: String(user._id), name: user.name, email: user.email, role: user.role }
    });
  } catch (error) { next(error); }
};
