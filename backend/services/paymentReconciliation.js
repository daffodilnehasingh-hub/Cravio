const Razorpay = require("razorpay");
const Order = require("../models/Order");
const notify = require("../utils/createNotification");

const INTERVAL_MS = 2 * 60 * 1000;
const GRACE_MS = 5 * 60 * 1000;
const BATCH_SIZE = 30;
let timer = null;
let running = false;

function gatewayClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

async function restoreReservedStock(order) {
  if (!order.stockDeducted || !order.outlet?.outletId) return;
  const Outlet = require("../models/Outlet");
  for (const item of order.items || []) {
    await Outlet.updateOne(
      { outletId: String(order.outlet.outletId), "items.itemId": String(item.itemId) },
      { $inc: { "items.$.stockQuantity": Number(item.quantity) } }
    );
  }
}

async function confirmCapturedPayment(order, payment) {
  if (Number(payment.amount) !== Math.round(order.total * 100) ||
      payment.currency !== "INR" || payment.status !== "captured") {
    console.warn(`Cravio payment reconciliation: amount/currency/status mismatch for order ${order.orderNumber}`);
    return false;
  }

  const confirmed = await Order.findOneAndUpdate(
    { _id: order._id, status: "payment_pending", paymentStatus: "pending",
      razorpayOrderId: payment.order_id },
    { $set: { paymentStatus: "paid", razorpayPaymentId: payment.id, status: "placed" },
      $push: { statusHistory: { status: "placed", note: "Payment captured and reconciled with Razorpay." } } },
    { new: true }
  );
  if (!confirmed) return false;

  if (confirmed.couponCode) {
    const Coupon = require("../models/Coupon");
    await Coupon.updateOne({ code: confirmed.couponCode }, { $inc: { usedCount: 1 } });
  }
  await notify(confirmed.customer, "Payment successful",
    `Payment received for order ${confirmed.orderNumber}.`, "order",
    `receipt.html?id=${confirmed._id}`);
  const io = global.cravioIO;
  if (io) io.to(`order:${confirmed._id}`).emit("order:updated", {
    status: "placed", paymentStatus: "paid"
  });
  return true;
}

async function expireUnpaidOrder(order) {
  // Claim the order first. Only the process that wins this atomic update restores stock.
  const closed = await Order.findOneAndUpdate(
    { _id: order._id, status: "payment_pending", paymentStatus: "pending" },
    { $set: { status: "cancelled", paymentStatus: "failed",
      cancelledAt: new Date(), cancellationReason: "Razorpay payment window expired.",
      stockDeducted: false },
      $push: { statusHistory: { status: "cancelled", note: "Razorpay order expired without a captured payment. Reserved stock released." } } },
    { new: true }
  );
  if (!closed) return false;

  // `closed` has stockDeducted=false after the claim; use the pre-claim value.
  if (order.stockDeducted) {
    await restoreReservedStock({ ...closed.toObject(), stockDeducted: true });
  }
  await notify(closed.customer, "Payment window expired",
    `The payment window for order ${closed.orderNumber} expired. You can place a new order.`, "order",
    `orders.html`);
  const io = global.cravioIO;
  if (io) io.to(`order:${closed._id}`).emit("order:updated", {
    status: "cancelled", paymentStatus: "failed"
  });
  return true;
}

async function reconcilePendingPayments() {
  if (running) return;
  const gateway = gatewayClient();
  if (!gateway) return;
  running = true;
  try {
    const now = new Date();
    const pending = await Order.find({
      paymentMethod: "razorpay",
      status: "payment_pending",
      paymentStatus: "pending",
      razorpayOrderId: { $ne: "" },
      paymentPendingExpiresAt: { $ne: null, $lte: new Date(now.getTime() - GRACE_MS) }
    }).sort({ paymentPendingExpiresAt: 1 }).limit(BATCH_SIZE);

    for (const order of pending) {
      try {
        // Query Razorpay, not the browser, for the authoritative gateway state.
        const [gatewayOrder, paymentList] = await Promise.all([
          gateway.orders.fetch(order.razorpayOrderId),
          gateway.orders.fetchPayments(order.razorpayOrderId)
        ]);
        const payments = paymentList.items || [];
        const captured = payments.find(payment => payment.status === "captured");
        if (captured) {
          await confirmCapturedPayment(order, captured);
          continue;
        }

        // Authorized payments are not released: capture may still complete.
        if (payments.some(payment => payment.status === "authorized")) continue;

        // Do not release stock unless Razorpay reports the order expired, or
        // every recorded attempt is terminally failed and the grace period passed.
        const allAttemptsFailed = payments.length > 0 &&
          payments.every(payment => ["failed", "refunded"].includes(payment.status));
        if (gatewayOrder.status === "expired" || allAttemptsFailed) {
          await expireUnpaidOrder(order);
        }
      } catch (error) {
        // A temporary gateway/network failure must never release stock.
        console.warn(`Cravio payment reconciliation deferred for ${order.orderNumber}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error("Cravio payment reconciliation batch failed:", error.message);
  } finally {
    running = false;
  }
}

function startPaymentReconciliation() {
  if (timer) return;
  // Run once at startup, then on a fixed interval. No new scheduler dependency.
  reconcilePendingPayments();
  timer = setInterval(reconcilePendingPayments, INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
}

function stopPaymentReconciliation() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  startPaymentReconciliation,
  stopPaymentReconciliation,
  reconcilePendingPayments
};
