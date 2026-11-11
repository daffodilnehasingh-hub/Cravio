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
