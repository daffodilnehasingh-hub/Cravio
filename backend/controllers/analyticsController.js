const Order = require("../models/Order");

exports.getAnalyticsSummary = async (req, res, next) => {
  try {
    const allowedRanges = [7, 30, 90];
    const days = allowedRanges.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const now = new Date();
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));

    const filter = {
      createdAt: { $gte: start, $lte: now },
      status: { $ne: "payment_pending" }
    };
    if (req.user.role === "vendor") {
      filter["outlet.outletId"] = { $in: req.user.managedOutletIds || [] };
    }

    const orders = await Order.find(filter)
      .select("orderNumber outlet items subtotal discount deliveryFee total status paymentMethod paymentStatus createdAt")
      .lean();

    const confirmed = orders.filter(order => order.status !== "cancelled");
    const cancelledCount = orders.filter(order => order.status === "cancelled").length;
    const grossOrderValue = confirmed.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const collectedOnline = confirmed
      .filter(order => order.paymentStatus === "paid")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);
    const activeCount = orders.filter(order =>
      ["placed", "accepted", "preparing", "ready", "out_for_delivery"].includes(order.status)
    ).length;
    const completedCount = orders.filter(order =>
      ["delivered", "picked_up"].includes(order.status)
    ).length;

    const daily = new Map();
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + offset);
      daily.set(date.toISOString().slice(0, 10), { date: date.toISOString().slice(0, 10), orders: 0, orderValue: 0 });
    }
    for (const order of orders) {
      const key = new Date(order.createdAt).toISOString().slice(0, 10);
      const bucket = daily.get(key);
      if (!bucket) continue;
      bucket.orders += 1;
      if (order.status !== "cancelled") bucket.orderValue += Number(order.total || 0);
    }

    const dishMap = new Map();
    const outletMap = new Map();
    for (const order of confirmed) {
      const outletId = String(order.outlet?.outletId || "unknown");
      const outletName = order.outlet?.name || "Outlet";
      if (!outletMap.has(outletId)) {
        outletMap.set(outletId, { outletId, name: outletName, orders: 0, orderValue: 0, itemsSold: 0 });
      }
      const outletStats = outletMap.get(outletId);
      outletStats.orders += 1;
      outletStats.orderValue += Number(order.total || 0);
      for (const item of order.items || []) {
        const key = `${outletId}:${String(item.itemId || item.name)}`;
        if (!dishMap.has(key)) dishMap.set(key, {
          itemId: String(item.itemId || ""),
          name: item.name || "Menu item",
          outletName,
          quantity: 0,
          sales: 0
        });
        const dish = dishMap.get(key);
        dish.quantity += Number(item.quantity || 0);
        dish.sales += Number(item.lineTotal || (item.unitPrice || 0) * (item.quantity || 0));
        outletStats.itemsSold += Number(item.quantity || 0);
      }
    }

    const statusCounts = {};
    for (const order of orders) statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    res.json({
      rangeDays: days,
      generatedAt: now,
      summary: {
        totalOrders: orders.length,
        activeOrders: activeCount,
        completedOrders: completedCount,
        cancelledOrders: cancelledCount,
        grossOrderValue: Math.round(grossOrderValue * 100) / 100,
        averageOrderValue: confirmed.length ? Math.round((grossOrderValue / confirmed.length) * 100) / 100 : 0,
        collectedOnline: Math.round(collectedOnline * 100) / 100,
        itemsSold: confirmed.reduce((sum, order) => sum + (order.items || []).reduce((n, item) => n + Number(item.quantity || 0), 0), 0)
      },
      daily: [...daily.values()],
      topDishes: [...dishMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8),
      outlets: [...outletMap.values()].sort((a, b) => b.orderValue - a.orderValue),
      statusCounts
    });
  } catch (error) { next(error); }
};


// Platform-wide snapshot for the centralized admin control center.
exports.getAdminOverview = async (req, res, next) => {
  try {
    const User = require("../models/User");
    const Outlet = require("../models/Outlet");
    const Coupon = require("../models/Coupon");
    const SupportTicket = require("../models/SupportTicket");
    const Order = require("../models/Order");
    const [
      totalCustomers, activeCustomers, totalVendors, totalDeliveryPartners,
      totalOutlets, activeOutlets, totalOrders, pendingOrders, pendingRefunds,
      openTickets, activeCoupons, recentOrders
    ] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      User.countDocuments({ role: "customer", isActive: true }),
      User.countDocuments({ role: "vendor" }),
      User.countDocuments({ role: "delivery" }),
      Outlet.countDocuments({}),
      Outlet.countDocuments({ isActive: true }),
      Order.countDocuments({ status: { $ne: "payment_pending" } }),
      Order.countDocuments({ status: { $in: ["placed", "accepted", "preparing", "ready", "out_for_delivery"] } }),
      Order.countDocuments({ "refund.status": { $in: ["requested", "processing", "pending"] } }),
      SupportTicket.countDocuments({ status: { $in: ["open", "in_progress"] } }),
      Coupon.countDocuments({ active: true }),
      Order.find({}).sort({ createdAt: -1 }).limit(8)
        .select("orderNumber customer outlet total status paymentStatus createdAt")
        .populate("customer", "name email").lean()
    ]);
    res.json({
      generatedAt: new Date(),
      counts: {
        totalCustomers, activeCustomers, totalVendors, totalDeliveryPartners,
        totalOutlets, activeOutlets, totalOrders, pendingOrders, pendingRefunds,
        openTickets, activeCoupons
      },
      recentOrders: recentOrders.map(order => ({
        id: String(order._id),
        orderNumber: order.orderNumber,
        customerName: order.customer?.name || "Customer account unavailable",
        customerEmail: order.customer?.email || "",
        outletName: order.outlet?.name || "Outlet",
        total: Number(order.total || 0),
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt
      }))
    });
  } catch (error) { next(error); }
};
