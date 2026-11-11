const notify = require("../utils/createNotification");
const Order = require("../models/Order");
const User = require("../models/User");
const outlets = require("../config/catalogue");
const Razorpay = require("razorpay");

const roundMoney = value => Math.round(value * 100) / 100;

// Award once, only after a paid order is successfully completed.
async function awardOrderRewards(order) {
  if (!order || !["delivered", "picked_up"].includes(order.status) ||
      order.rewardPointsAwardedAt ||
      (order.paymentMethod === "razorpay" && order.paymentStatus !== "paid")) return 0;
  const points = Math.floor(Math.max(0, Number(order.total || 0)) / 10);
  if (!points) {
    order.rewardPointsAwardedAt = new Date();
    await order.save();
    return 0;
  }
  const claimed = await Order.updateOne(
    { _id: order._id, rewardPointsAwardedAt: null, rewardPointsAwarded: 0 },
    { $set: { rewardPointsAwarded: points, rewardPointsAwardedAt: new Date() } }
  );
  if (!claimed.modifiedCount) return 0;
  await User.updateOne({ _id: order.customer }, {
    $inc: { rewardPoints: points, lifetimeRewardPoints: points }
  });
  await notify(order.customer, "You earned Cravio points!", `You earned ${points} points for completing order ${order.orderNumber}.`, "system", "customer-dashboard.html");
  return points;
}

// Atomic stock decrement prevents two simultaneous checkouts from selling the same units.
async function deductOutletStock(outletId, items) {
  const Outlet = require("../models/Outlet");
  const applied = [];
  for (const item of items) {
    const updated = await Outlet.updateOne(
      { outletId: String(outletId), items: { $elemMatch: {
        itemId: String(item.itemId), available: true, stockQuantity: { $gte: Number(item.quantity) }
      } } },
      { $inc: { "items.$.stockQuantity": -Number(item.quantity) } }
    );
    if (!updated.modifiedCount) {
      for (const done of applied) {
        await Outlet.updateOne(
          { outletId: String(outletId), "items.itemId": done.itemId },
          { $inc: { "items.$.stockQuantity": done.quantity } }
        );
      }
      const outlet = await Outlet.findOne({ outletId: String(outletId) }).select("items");
      const current = outlet?.items.find(x => x.itemId === String(item.itemId));
      const available = current ? current.stockQuantity : 0;
      throw new Error(current && current.available
        ? `${current.name} has only ${available} item(s) left. Please update your cart.`
        : "One or more items are unavailable. Please refresh your menu.");
    }
    applied.push({ itemId: String(item.itemId), quantity: Number(item.quantity) });
  }
  return true;
}

async function restoreOutletStock(order) {
  if (!order || !order.stockDeducted || !order.outlet?.outletId) return;
  const Outlet = require("../models/Outlet");
  for (const item of order.items || []) {
    await Outlet.updateOne(
      { outletId: String(order.outlet.outletId), "items.itemId": String(item.itemId) },
      { $inc: { "items.$.stockQuantity": Number(item.quantity) } }
    );
  }
  order.stockDeducted = false;
}

exports.createOrder = async (req, res, next) => {
  try {
    const {
      outletId, items, fulfillmentType, deliveryAddress,
      paymentMethod, couponCode, studentDiscountApplied, redeemRewardPoints
    } = req.body;

    if (!outletId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Choose an outlet and add items to your cart." });
    }
    const Outlet = require("../models/Outlet");
    const dbOutlet = await Outlet.findOne({ outletId: String(outletId), isActive: true, $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }] });
    const outlet = dbOutlet ? {
      name: dbOutlet.name, type: dbOutlet.type, delivery: dbOutlet.delivery,
      items: Object.fromEntries(dbOutlet.items.filter(i=>i.available).map(i=>[i.itemId,{name:i.name,price:i.price,isVeg:i.isVeg}]))
    } : outlets[String(outletId)];
    if (!outlet) return res.status(400).json({ message: "This outlet is not available." });
    if (!["delivery", "pickup"].includes(fulfillmentType)) {
      return res.status(400).json({ message: "Choose delivery or self-pickup." });
    }
    if (fulfillmentType === "delivery" && !outlet.delivery) {
      return res.status(400).json({ message: "This outlet supports self-pickup only." });
    }
    if (!["cod", "upi", "outlet", "razorpay"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Choose a valid payment method." });
    }
    if (fulfillmentType === "delivery") {
      const a = deliveryAddress || {};
      if (!a.fullName || !/^[0-9]{10}$/.test(String(a.phone || "")) ||
          !/^[0-9]{6}$/.test(String(a.pincode || "")) || !a.house || !a.area) {
        return res.status(400).json({ message: "Enter a complete delivery address and valid phone number and PIN code." });
      }
    }

    let subtotal = 0;
    const normalizedItems = [];
    for (const item of items) {
      const catalogueItem = outlet.items[String(item.itemId)];
      const quantity = Number(item.quantity);
      if (!catalogueItem || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        return res.status(400).json({ message: "Your cart contains an invalid item or quantity. Please refresh your menu." });
      }
      const lineTotal = roundMoney(catalogueItem.price * quantity);
      subtotal += lineTotal;
      normalizedItems.push({
        itemId: String(item.itemId),
        name: catalogueItem.name,
        quantity,
        unitPrice: catalogueItem.price,
        lineTotal,
        isVeg: catalogueItem.isVeg
      });
    }
    subtotal = roundMoney(subtotal);

    let discount = 0;
    const normalizedCoupon = String(couponCode || "").trim().toUpperCase();
    let appliedCoupon = null;
    if (normalizedCoupon) {
      const Coupon = require("../models/Coupon");
      appliedCoupon = await Coupon.findOne({ code: normalizedCoupon, active: true });
      const now = new Date();
      if (!appliedCoupon || appliedCoupon.startsAt > now ||
          (appliedCoupon.expiresAt && appliedCoupon.expiresAt < now) ||
          (appliedCoupon.usageLimit !== null && appliedCoupon.usedCount >= appliedCoupon.usageLimit) ||
          subtotal < appliedCoupon.minOrderValue ||
          (appliedCoupon.outletType !== "all" && appliedCoupon.outletType !== outlet.type)) {
        return res.status(400).json({ message: "The coupon is invalid, expired or does not meet its conditions." });
      }
      discount = appliedCoupon.discountType === "percentage"
        ? subtotal * appliedCoupon.discountValue / 100 : appliedCoupon.discountValue;
      if (appliedCoupon.maxDiscount !== null) discount = Math.min(discount, appliedCoupon.maxDiscount);
    }

    let verifiedStudent = false;
    if (studentDiscountApplied === true) {
      const user = await User.findById(req.user.id).select("isStudentVerified");
      verifiedStudent = Boolean(user && user.isStudentVerified);
      if (verifiedStudent) discount = Math.max(discount, subtotal * 0.15);
    }
    discount = roundMoney(Math.min(discount, subtotal));
    const deliveryFee = fulfillmentType === "delivery" && subtotal < 299 ? 25 : 0;
    let pointsToRedeem = Number(redeemRewardPoints || 0);
    if (!Number.isInteger(pointsToRedeem) || pointsToRedeem < 0) {
      return res.status(400).json({ message: "Reward points must be a non-negative whole number." });
    }
    if (pointsToRedeem && paymentMethod === "razorpay") {
      return res.status(400).json({ message: "Use cash on delivery or pay at outlet to redeem reward points in this version." });
    }
    // 10 points = ₹1. Redemption is capped at 500 points and the remaining food subtotal.
    const maxRedeem = Math.min(500, Math.floor(Math.max(0, subtotal - discount) * 10));
    if (pointsToRedeem > maxRedeem) {
      return res.status(400).json({ message: `You can redeem up to ${maxRedeem} points on this order.` });
    }
    const rewardDiscount = roundMoney(pointsToRedeem / 10);
    discount = roundMoney(discount + rewardDiscount);
    const total = roundMoney(subtotal - discount + deliveryFee);

    let razorpayInstance = null;
    if (paymentMethod === "razorpay") {
      const { areRealCredentials } = require("../utils/credentials");
      if (!areRealCredentials(process.env.RAZORPAY_KEY_ID, process.env.RAZORPAY_KEY_SECRET)) {
        return res.status(503).json({ message: "Online payments are not configured yet. Choose another payment method." });
      }
      razorpayInstance = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    }

    let stockWasDeducted = false;
    if (dbOutlet) {
      await deductOutletStock(String(outletId), normalizedItems);
      stockWasDeducted = true;
    }

    let order;
    try {
      order = await Order.create({
      customer: req.user.id,
      outlet: { outletId: String(outletId), name: outlet.name, type: outlet.type },
      items: normalizedItems,
      fulfillmentType,
      deliveryAddress: fulfillmentType === "delivery" ? deliveryAddress : undefined,
      paymentMethod,
      stockDeducted: stockWasDeducted,
      subtotal,
      discount,
      deliveryFee,
      total,
      couponCode: normalizedCoupon,
      studentDiscountApplied: verifiedStudent,
      rewardPointsRedeemed: pointsToRedeem,
      status: paymentMethod === "razorpay" ? "payment_pending" : "placed",
      statusHistory: [{ status: paymentMethod === "razorpay" ? "payment_pending" : "placed", note: paymentMethod === "razorpay" ? "Waiting for online payment confirmation." : "Order received by Cravio." }]
      });
    } catch (createError) {
      if (stockWasDeducted) await restoreOutletStock({ outlet: { outletId: String(outletId) }, items: normalizedItems, stockDeducted: true });
      throw createError;
    }

    if (pointsToRedeem) {
      const debited = await User.updateOne(
        { _id: req.user.id, rewardPoints: { $gte: pointsToRedeem } },
        { $inc: { rewardPoints: -pointsToRedeem } }
      );
      if (!debited.modifiedCount) {
        await restoreOutletStock(order);
        await Order.deleteOne({ _id: order._id });
        return res.status(409).json({ message: "Your reward balance changed. Refresh checkout and try again." });
      }
      await notify(req.user.id, "Cravio points redeemed", `${pointsToRedeem} points were used for order ${order.orderNumber}.`, "system", "customer-dashboard.html");
    }

    if (paymentMethod === "razorpay") {
      try {
        const paymentExpiry = new Date(Date.now() + 30 * 60 * 1000);
        const gatewayOrder = await razorpayInstance.orders.create({
          amount: Math.round(total * 100), currency: "INR",
          receipt: String(order._id), expire_by: Math.floor(paymentExpiry.getTime() / 1000),
          notes: { cravioOrderId: String(order._id), customerId: String(req.user.id) }
        });
        order.razorpayOrderId = gatewayOrder.id;
        order.paymentPendingExpiresAt = paymentExpiry;
        await order.save();
        return res.status(201).json({
          message: "Payment order created. Complete payment to confirm your order.", order,
          payment: { keyId: process.env.RAZORPAY_KEY_ID, razorpayOrderId: gatewayOrder.id,
            amount: gatewayOrder.amount, currency: gatewayOrder.currency,
            name: "Cravio", description: `Payment for ${order.orderNumber}`,
            prefill: { name: req.user.name || "", email: req.user.email || "" } }
        });
      } catch (gatewayError) {
        await restoreOutletStock(order);
        await Order.deleteOne({ _id: order._id, customer: req.user.id, paymentStatus: "pending" });
        throw gatewayError;
      }
    }
    if (appliedCoupon) {
      appliedCoupon.usedCount += 1;
      await appliedCoupon.save();
    }
    await notify(req.user.id, "Order placed", `Your order ${order.orderNumber} has been received.`, "order", "orders.html");
    return res.status(201).json({ message: "Your order has been placed.", order });
  } catch (error) { next(error); }
};

exports.verifyRazorpayPayment = async (req, res, next) => {
  try {
    const crypto = require("crypto");
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Payment verification details are incomplete." });
    }
    let order = await Order.findOne({ _id: orderId, customer: req.user.id, paymentMethod: "razorpay" });
    if (!order) return res.status(404).json({ message: "Payment order not found." });
    if (order.paymentStatus === "paid") return res.json({ message: "Payment already verified.", order });
    if (!order.razorpayOrderId || order.razorpayOrderId !== razorpay_order_id || order.status !== "payment_pending") {
      return res.status(400).json({ message: "This payment does not match the pending Cravio order." });
    }
    if (!require("../utils/credentials").areRealCredentials(process.env.RAZORPAY_KEY_ID, process.env.RAZORPAY_KEY_SECRET)) {
      return res.status(503).json({ message: "Online payment verification is not configured yet." });
    }
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    const a = Buffer.from(expected, "hex"), b = Buffer.from(String(razorpay_signature), "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).json({ message: "Payment signature verification failed. Your order has not been confirmed." });
    }

    // A valid signature proves the callback belongs to this Razorpay order.
    // Fetch the payment from Razorpay as a second server-side check before confirming.
    const gateway = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    const gatewayPayment = await gateway.payments.fetch(razorpay_payment_id);
    if (gatewayPayment.order_id !== razorpay_order_id ||
        Number(gatewayPayment.amount) !== Math.round(order.total * 100) ||
        gatewayPayment.currency !== "INR" ||
        !["authorized", "captured"].includes(gatewayPayment.status)) {
      return res.status(400).json({ message: "Razorpay payment details do not match this order." });
    }
    if (gatewayPayment.status === "authorized") {
      // Capture is intentionally not assumed; this project expects automatic capture
      // to be enabled in the Razorpay dashboard.
      return res.status(409).json({ message: "Payment is authorized but not captured yet. Please wait and refresh your orders." });
    }

    // Conditional update prevents duplicate callbacks/retries from confirming twice.
    const confirmed = await Order.findOneAndUpdate(
      { _id: order._id, customer: req.user.id, paymentMethod: "razorpay",
        razorpayOrderId: razorpay_order_id, status: "payment_pending", paymentStatus: "pending" },
      { $set: { paymentStatus: "paid", razorpayPaymentId: razorpay_payment_id, status: "placed" },
        $push: { statusHistory: { status: "placed", note: "Payment captured and verified by Razorpay. Order confirmed." } } },
      { new: true }
    );
    if (!confirmed) {
      const latest = await Order.findOne({ _id: order._id, customer: req.user.id });
      if (latest && latest.paymentStatus === "paid" && latest.razorpayPaymentId === razorpay_payment_id) {
        return res.json({ message: "Payment already verified.", order: latest });
      }
      return res.status(409).json({ message: "This order is no longer awaiting this payment." });
    }
    order = confirmed;
    if (order.couponCode) {
      const Coupon = require("../models/Coupon");
      await Coupon.updateOne({ code: order.couponCode }, { $inc: { usedCount: 1 } });
    }
    await notify(req.user.id, "Payment successful", `Payment received for order ${order.orderNumber}.`, "order", `receipt.html?id=${order._id}`);
    res.json({ message: "Payment verified and order confirmed.", order });
  } catch (error) { next(error); }
};

exports.failRazorpayPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ message: "Order ID is required." });
    const order = await Order.findOne({
      _id: orderId, customer: req.user.id, paymentMethod: "razorpay",
      status: "payment_pending", paymentStatus: "pending"
    });
    if (!order) return res.json({ message: "No pending payment order needs updating." });
    if (!require("../utils/credentials").areRealCredentials(process.env.RAZORPAY_KEY_ID, process.env.RAZORPAY_KEY_SECRET) || !order.razorpayOrderId) {
      return res.status(503).json({ message: "Payment status could not be checked. The order remains pending; check My Orders before retrying." });
    }
    const gateway = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const gatewayPayments = await gateway.orders.fetchPayments(order.razorpayOrderId);
    const hasCapturedOrAuthorized = (gatewayPayments.items || []).some(payment =>
      ["authorized", "captured"].includes(payment.status)
    );
    if (hasCapturedOrAuthorized) {
      return res.status(409).json({ message: "Razorpay has a payment in progress or completed. Cravio will confirm it after verification." });
    }

    // Do not release stock or close the order from a browser-dismiss event.
    // Payment state can arrive asynchronously; the signed webhook is authoritative.
    order.statusHistory.push({
      status: "payment_pending",
      note: "Checkout closed or payment attempt failed. Awaiting a final Razorpay payment event."
    });
    await order.save();
    res.json({ message: "Payment is not confirmed yet. The order remains pending while Cravio awaits Razorpay's final status.", order });
  } catch (error) { next(error); }
};

exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ customer: req.user.id }).sort({ createdAt: -1 }).limit(100);
    const Review = require("../models/Review");
    const reviewedIds = new Set((await Review.find({ customer: req.user.id }).select("order")).map(r => String(r.order)));
    res.json({ orders: orders.map(order => ({ ...order.toObject(), reviewed: reviewedIds.has(String(order._id)) })) });
  } catch (error) { next(error); }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, customer: req.user.id }).populate("deliveryPartner", "name phone");
    if (!order) return res.status(404).json({ message: "Order not found." });
    res.json({ order });
  } catch (error) { next(error); }
};

exports.getAllOrders = async (req, res, next) => {
  try {
    const filter = { status: { $ne: "payment_pending" } };
    if (req.user.role === "vendor") filter["outlet.outletId"] = { $in: req.user.managedOutletIds || [] };
    const allowedStatuses = ["placed","accepted","preparing","ready","out_for_delivery","delivered","picked_up","cancelled"];
    if (req.query.status && req.query.status !== "all") {
      if (!allowedStatuses.includes(req.query.status)) return res.status(400).json({ message: "Invalid order status filter." });
      filter.status = req.query.status;
    }
    if (req.query.outletId) {
      if (req.user.role === "vendor" && !(req.user.managedOutletIds || []).includes(String(req.query.outletId))) {
        return res.status(403).json({ message: "This outlet is not assigned to you." });
      }
      filter["outlet.outletId"] = String(req.query.outletId);
    }
    if (["delivery","pickup"].includes(req.query.fulfillmentType)) filter.fulfillmentType = req.query.fulfillmentType;
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(200)
      .populate("customer", "name email phone").populate("deliveryPartner", "name phone");
    res.json({ orders });
  } catch (error) { next(error); }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const allowed = ["accepted", "preparing", "ready", "out_for_delivery", "delivered", "picked_up", "cancelled"];
    const { status, note, estimatedPreparationMinutes } = req.body;
    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid order status." });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (req.user.role === "vendor" &&
        !(req.user.managedOutletIds || []).includes(order.outlet.outletId)) {
      return res.status(403).json({ message: "You can only update orders from your assigned outlet." });
    }
    if (req.user.role === "vendor" && status !== "cancelled") {
      const nextByStatus = { placed: "accepted", accepted: "preparing", preparing: "ready" };
      if (nextByStatus[order.status] !== status && order.status !== status) {
        return res.status(409).json({ message: `Vendor kitchen workflow: ${order.status.replace(/_/g," ")} → ${nextByStatus[order.status] || "no further kitchen action"}.` });
      }
    }
    if (estimatedPreparationMinutes !== undefined) {
      const minutes = Number(estimatedPreparationMinutes);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
        return res.status(400).json({ message: "Preparation time must be a whole number between 1 and 240 minutes." });
      }
      if (!["accepted","preparing"].includes(status)) {
        return res.status(400).json({ message: "Set preparation time when accepting or starting preparation." });
      }
      order.estimatedPreparationMinutes = minutes;
    }
    if (status === "accepted") order.acceptedAt = order.acceptedAt || new Date();
    if (status === "preparing") order.preparingAt = order.preparingAt || new Date();
    if (status === "ready") order.readyAt = new Date();
    if (status === "cancelled" && order.status !== "cancelled") {
      await restoreOutletStock(order);
      if (order.rewardPointsRedeemed > 0 && !order.rewardPointsRestoredAt) {
        await User.updateOne({ _id: order.customer, $inc: { rewardPoints: order.rewardPointsRedeemed } });
        order.rewardPointsRestoredAt = new Date();
      }
      if (order.deliveryPartner) await User.updateOne({ _id: order.deliveryPartner, role: "delivery" }, { $set: { deliveryAvailability: "available" } });
      order.cancelledAt = new Date();
    }
    order.status = status;
    const safeNote = typeof note === "string" ? note.trim().slice(0,300) : "";
    order.statusHistory.push({ status, note: safeNote || `Order status changed to ${status}.` });
    await order.save();
    if (["delivered", "picked_up"].includes(status)) await awardOrderRewards(order);
    await notify(order.customer, "Order update", `Your order ${order.orderNumber} is now ${status.replace(/_/g," ")}.`, "order", `receipt.html?id=${order._id}`);
    const io = req.app.get("io");
    if (io) io.to(`order:${order._id}`).emit("order:updated", {
      status, estimatedPreparationMinutes: order.estimatedPreparationMinutes,
      acceptedAt: order.acceptedAt, preparingAt: order.preparingAt, readyAt: order.readyAt
    });
    // Re-fetch so the response reflects reward points applied by awardOrderRewards.
    const freshOrder = await Order.findById(order._id);
    res.json({ message: "Order status updated.", order: freshOrder });
  } catch (error) { next(error); }
};

exports.getDeliveryPartners = async (req, res, next) => {
  try {
    const partners = await User.find({
      role: "delivery", isActive: { $ne: false }, deliveryAvailability: "available"
    }).select("name phone email deliveryAvailability");
    res.json({ partners });
  } catch (error) { next(error); }
};

exports.assignDeliveryPartner = async (req, res, next) => {
  try {
    const { deliveryPartnerId, estimatedDeliveryMinutes } = req.body;
    const minutes = Number(estimatedDeliveryMinutes);
    if (!deliveryPartnerId || !Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
      return res.status(400).json({ message: "Choose a delivery partner and an ETA between 1 and 240 minutes." });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (order.fulfillmentType !== "delivery") return res.status(400).json({ message: "Only delivery orders can be assigned." });
    if (order.status !== "ready") return res.status(400).json({ message: "The outlet must mark the order ready before assigning delivery." });
    if (req.user.role === "vendor" && !(req.user.managedOutletIds || []).includes(order.outlet.outletId)) {
      return res.status(403).json({ message: "You can only assign orders from your assigned outlet." });
    }
    const partner = await User.findOneAndUpdate(
      { _id: deliveryPartnerId, role: "delivery", isActive: { $ne: false }, deliveryAvailability: "available" },
      { $set: { deliveryAvailability: "busy" } },
      { new: true }
    );
    if (!partner) return res.status(400).json({ message: "Selected delivery partner is unavailable or already assigned." });
    order.deliveryPartner = partner._id;
    order.estimatedDeliveryMinutes = minutes;
    order.deliveryAssignedAt = new Date();
    order.status = "ready";
    order.statusHistory.push({ status: "ready", note: `Delivery assigned to ${partner.name}.` });
    try {
      await order.save();
    } catch (saveError) {
      await User.updateOne({ _id: partner._id, deliveryAvailability: "busy" }, { $set: { deliveryAvailability: "available" } });
      throw saveError;
    }
    const populated = await Order.findById(order._id).populate("customer", "name").populate("deliveryPartner", "name phone");
    const io = req.app.get("io");
    if (io) io.to(`order:${order._id}`).emit("order:updated", { status: order.status, estimatedDeliveryMinutes: minutes });
    res.json({ message: "Delivery partner assigned.", order: populated });
  } catch (error) { next(error); }
};

exports.getMyDeliveryOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ deliveryPartner: req.user.id, fulfillmentType: "delivery", status: { $nin: ["delivered", "cancelled"] } })
      .populate("customer", "name phone").sort({ deliveryAssignedAt: -1 });
    res.json({ orders });
  } catch (error) { next(error); }
};

exports.updateDeliveryStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["out_for_delivery", "delivered"].includes(status)) {
      return res.status(400).json({ message: "Delivery partners can set only Out for delivery or Delivered." });
    }
    const order = await Order.findOne({ _id: req.params.id, deliveryPartner: req.user.id, fulfillmentType: "delivery" });
    if (!order) return res.status(404).json({ message: "Assigned delivery order not found." });
    if (status === "out_for_delivery" && !["ready", "out_for_delivery"].includes(order.status)) {
      return res.status(400).json({ message: "The order must be marked ready before delivery starts." });
    }
    order.status = status;
    if (status === "delivered") {
      order.deliveredAt = new Date();
      await User.updateOne({ _id: req.user.id, role: "delivery" }, { $set: { deliveryAvailability: "available" } });
    }
    order.statusHistory.push({ status, note: status === "delivered" ? "Delivery completed." : "Delivery partner started the trip." });
    await order.save();
    if (status === "delivered") await awardOrderRewards(order);
    await notify(order.customer, "Delivery update", `Your order ${order.orderNumber} is now ${status.replace(/_/g," ")}.`, "order", `receipt.html?id=${order._id}`);
    const io = req.app.get("io");
    if (io) io.to(`order:${order._id}`).emit("order:updated", { status });
    // Re-fetch so the response reflects reward points applied by awardOrderRewards.
    const freshOrder = await Order.findById(order._id);
    res.json({ message: "Delivery status updated.", order: freshOrder });
  } catch (error) { next(error); }
};

exports.updateDeliveryLocation = async (req, res, next) => {
  try {
    const lat = Number(req.body.lat), lng = Number(req.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ message: "A valid latitude and longitude are required." });
    }
    const order = await Order.findOne({ _id: req.params.id, deliveryPartner: req.user.id, status: "out_for_delivery" });
    if (!order) return res.status(404).json({ message: "Active assigned delivery not found." });
    order.deliveryLocation = { lat, lng, updatedAt: new Date() };
    await order.save();
    const payload = { lat, lng, updatedAt: order.deliveryLocation.updatedAt };
    const io = req.app.get("io");
    if (io) io.to(`order:${order._id}`).emit("delivery:location", payload);
    res.json({ message: "Location shared.", location: payload });
  } catch (error) { next(error); }
};


exports.cancelMyOrder = async (req, res, next) => {
  try {
    const reason = String(req.body.reason || "").trim().slice(0, 300);
    const order = await Order.findOne({ _id: req.params.id, customer: req.user.id });
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (order.status !== "placed") {
      return res.status(400).json({ message: "This order can no longer be cancelled. Please contact support if you need help." });
    }
    order.status = "cancelled";
    await restoreOutletStock(order);
    if (order.rewardPointsRedeemed > 0 && !order.rewardPointsRestoredAt) {
      await User.updateOne({ _id: order.customer, $inc: { rewardPoints: order.rewardPointsRedeemed } });
      order.rewardPointsRestoredAt = new Date();
    }
    order.cancelledAt = new Date();
    order.cancellationReason = reason;
    order.statusHistory.push({ status: "cancelled", note: reason ? `Customer cancelled: ${reason}` : "Customer cancelled the order." });
    await order.save();
    await notify(order.customer, "Order cancelled", `Your order ${order.orderNumber} was cancelled.`, "order", `receipt.html?id=${order._id}`);
    const io = req.app.get("io");
    if (io) io.to(`order:${order._id}`).emit("order:updated", { status: "cancelled" });
    res.json({ message: "Your order has been cancelled.", order });
  } catch (error) { next(error); }
};


exports.requestRefund = async (req, res, next) => {
  try {
    const reason = String(req.body.reason || "").trim();
    if (!reason || reason.length > 500) {
      return res.status(400).json({ message: "Enter a refund reason (maximum 500 characters)." });
    }
    const order = await Order.findOne({ _id: req.params.id, customer: req.user.id });
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (order.paymentMethod !== "razorpay" || order.paymentStatus !== "paid" || !order.razorpayPaymentId) {
      return res.status(400).json({ message: "Only successfully paid Razorpay orders can be refunded through Cravio." });
    }
    if (!["cancelled", "delivered", "picked_up"].includes(order.status)) {
      return res.status(400).json({ message: "Refund requests are available after an order is cancelled or completed." });
    }
    if (order.refund && order.refund.status) {
      return res.status(409).json({ message: "A refund request already exists for this order." });
    }
    order.refund = {
      status: "requested",
      reason,
      amount: order.total,
      requestedAt: new Date()
    };
    await order.save();
    await notify(order.customer, "Refund requested", `Your refund request for order ${order.orderNumber} has been submitted for review.`, "order", "orders.html");
    res.status(201).json({ message: "Refund request submitted. Cravio's admin team will review it.", order });
  } catch (error) { next(error); }
};

exports.getRefundRequests = async (req, res, next) => {
  try {
    const orders = await Order.find({ "refund.status": { $in: ["requested", "processing", "pending", "failed"] } })
      .sort({ "refund.requestedAt": 1 })
      .limit(200)
      .populate("customer", "name email phone");
    res.json({ refunds: orders });
  } catch (error) { next(error); }
};

exports.reviewRefundRequest = async (req, res, next) => {
  try {
    const action = String(req.body.action || "");
    const adminNote = String(req.body.adminNote || "").trim().slice(0, 500);
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Choose approve or reject." });
    }
    let order = await Order.findById(req.params.id).populate("customer", "name email");
    if (!order || !order.refund?.status) return res.status(404).json({ message: "Refund request not found." });
    if (order.paymentMethod !== "razorpay" || !order.razorpayPaymentId) {
      return res.status(400).json({ message: "This order does not have a refundable Razorpay payment." });
    }

    if (action === "reject") {
      if (order.refund.status !== "requested") {
        return res.status(409).json({ message: "Only a newly requested refund can be rejected." });
      }
      order.refund.status = "rejected";
      order.refund.adminNote = adminNote || "Refund request rejected by Cravio.";
      order.refund.reviewedAt = new Date();
      await order.save();
      await notify(order.customer._id, "Refund request update",
        `Your refund request for order ${order.orderNumber} was not approved.`, "order", "orders.html");
      return res.json({ message: "Refund request rejected.", order });
    }

    if (!["requested", "processing", "failed"].includes(order.refund.status)) {
      return res.status(409).json({ message: "This refund request is already being processed or completed." });
    }
    if (!require("../utils/credentials").areRealCredentials(process.env.RAZORPAY_KEY_ID, process.env.RAZORPAY_KEY_SECRET)) {
      return res.status(503).json({ message: "Razorpay refund credentials are not configured yet." });
    }

    const crypto = require("crypto");
    // Persist a stable key before the API call. If the network times out, retrying
    // this exact request uses the same provider idempotency key and amount.
    if (!order.refund.idempotencyKey || order.refund.status === "failed") {
      order.refund.idempotencyKey = crypto.randomUUID();
    }
    const idempotencyKey = order.refund.idempotencyKey;
    const refundAmount = Math.round(order.total * 100);
    order.refund.status = "processing";
    order.refund.adminNote = adminNote || order.refund.adminNote || "Refund approved by Cravio.";
    order.refund.reviewedAt = order.refund.reviewedAt || new Date();
    await order.save();

    try {
      const endpoint = `https://api.razorpay.com/v1/payments/${encodeURIComponent(order.razorpayPaymentId)}/refund`;
      const gatewayResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
          "Content-Type": "application/json",
          "X-Refund-Idempotency": idempotencyKey
        },
        body: JSON.stringify({
          amount: refundAmount,
          notes: { cravioOrderId: String(order._id), cravioOrderNumber: order.orderNumber }
        })
      });
      const result = await gatewayResponse.json().catch(() => ({}));
      if (!gatewayResponse.ok) {
        // Keep processing for server/ambiguous conflicts so an admin can safely retry
        // with the same idempotency key. Definite 4xx validation failures are visible.
        if (gatewayResponse.status >= 400 && gatewayResponse.status < 500 && gatewayResponse.status !== 409) {
          order.refund.status = "failed";
          order.refund.adminNote = result.error?.description || "Razorpay rejected the refund request.";
          await order.save();
        }
        return res.status(gatewayResponse.status === 409 ? 409 : 502).json({
          message: result.error?.description || "Razorpay did not confirm the refund request. You can safely retry from the admin queue."
        });
      }

      order.refund.razorpayRefundId = result.id || order.refund.razorpayRefundId;
      order.refund.status = result.status === "processed" ? "processed" : "pending";
      if (result.status === "processed") {
        order.refund.processedAt = new Date();
        order.paymentStatus = "refunded";
      }
      await order.save();
      await notify(order.customer._id, "Refund approved",
        `A refund for order ${order.orderNumber} has been initiated.`, "order", "orders.html");
      return res.json({ message: result.status === "processed" ? "Refund processed by Razorpay." : "Refund initiated. Razorpay is processing it.", order });
    } catch (gatewayError) {
      // Leave state as processing and retain idempotency key; the admin can retry.
      return res.status(502).json({ message: "Could not confirm Razorpay's response. Retry this same refund from the admin queue; the idempotency key is preserved." });
    }
  } catch (error) { next(error); }
};
