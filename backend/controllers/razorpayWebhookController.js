const crypto = require("crypto");
const Order = require("../models/Order");
const notify = require("../utils/createNotification");

function validWebhookSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || !signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(String(signature), "hex");
  return expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

exports.handleRazorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.get("x-razorpay-signature");
    if (!secret) return res.status(503).json({ message: "Razorpay webhook is not configured." });
    if (!validWebhookSignature(req.body, signature, secret)) {
      return res.status(400).json({ message: "Invalid webhook signature." });
    }

    let event;
    try { event = JSON.parse(req.body.toString("utf8")); }
    catch { return res.status(400).json({ message: "Invalid webhook payload." }); }

    // Refund state is also finalized from signed provider events.
    if (event.event === "refund.processed" || event.event === "refund.failed") {
      const refundEntity = event.payload?.refund?.entity;
      if (!refundEntity?.payment_id || !refundEntity?.id) {
        return res.status(400).json({ message: "Refund event details are missing." });
      }
      const refundOrder = await Order.findOne({
        razorpayPaymentId: refundEntity.payment_id,
        "refund.status": { $in: ["processing", "pending", "failed"] }
      });
      if (!refundOrder || (refundOrder.refund.razorpayRefundId &&
          refundOrder.refund.razorpayRefundId !== refundEntity.id)) {
        return res.status(200).json({ received: true, ignored: true });
      }
      if (refundOrder.refund.status === "processed") {
        return res.status(200).json({ received: true, alreadyProcessed: true });
      }
      const finalStatus = event.event === "refund.processed" ? "processed" : "failed";
      const update = {
        "refund.status": finalStatus,
        "refund.processedAt": finalStatus === "processed" ? new Date() : null
      };
      if (finalStatus === "processed") update.paymentStatus = "refunded";
      const changed = await Order.findOneAndUpdate(
        { _id: refundOrder._id,
          "refund.status": { $in: ["processing", "pending", "failed"] },
          $or: [
            { "refund.razorpayRefundId": refundEntity.id },
            { "refund.razorpayRefundId": "" },
            { "refund.razorpayRefundId": null }
          ] },
        { $set: { ...update, "refund.razorpayRefundId": refundEntity.id } }, { new: true }
      );
      if (changed) {
        await notify(changed.customer,
          finalStatus === "processed" ? "Refund processed" : "Refund failed",
          finalStatus === "processed"
            ? `Your refund for order ${changed.orderNumber} has been processed by Razorpay.`
            : `Razorpay could not process the refund for order ${changed.orderNumber}. Please contact Cravio support.`,
          "order", "orders.html");
        const io = req.app.get("io");
        if (io) io.to(`order:${changed._id}`).emit("order:updated", {
          status: changed.status, paymentStatus: changed.paymentStatus,
          refundStatus: changed.refund.status
        });
      }
      return res.status(200).json({ received: true, refundUpdated: Boolean(changed) });
    }

    // We confirm orders only from payment.captured, never from a browser redirect
    // or the less-final payment.authorized event.
    if (event.event !== "payment.captured") {
      return res.status(200).json({ received: true, ignored: true });
    }

    const payment = event.payload?.payment?.entity;
    if (!payment?.order_id || !payment?.id) {
      return res.status(400).json({ message: "Captured payment details are missing." });
    }

    const order = await Order.findOne({
      razorpayOrderId: payment.order_id,
      paymentMethod: "razorpay"
    });
    if (!order) {
      // Acknowledge unknown/old orders to avoid an endless webhook retry loop.
      return res.status(200).json({ received: true, ignored: true });
    }

    if (Number(payment.amount) !== Math.round(order.total * 100) ||
        payment.currency !== "INR") {
      return res.status(400).json({ message: "Captured payment amount or currency does not match the Cravio order." });
    }

    if (order.paymentStatus === "paid") {
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }
    if (order.status !== "payment_pending" || order.paymentStatus !== "pending") {
      return res.status(200).json({ received: true, ignored: true });
    }

    const confirmed = await Order.findOneAndUpdate(
      { _id: order._id, status: "payment_pending", paymentStatus: "pending",
        razorpayOrderId: payment.order_id },
      { $set: { paymentStatus: "paid", razorpayPaymentId: payment.id, status: "placed" },
        $push: { statusHistory: { status: "placed", note: "Payment captured and confirmed through Razorpay webhook." } } },
      { new: true }
    );

    if (!confirmed) {
      const latest = await Order.findById(order._id).select("paymentStatus razorpayPaymentId");
      if (latest?.paymentStatus === "paid") {
        return res.status(200).json({ received: true, alreadyProcessed: true });
      }
      return res.status(200).json({ received: true, ignored: true });
    }

    if (confirmed.couponCode) {
      const Coupon = require("../models/Coupon");
      await Coupon.updateOne({ code: confirmed.couponCode }, { $inc: { usedCount: 1 } });
    }
    await notify(confirmed.customer, "Payment successful",
      `Payment received for order ${confirmed.orderNumber}.`, "order",
      `receipt.html?id=${confirmed._id}`);

    const io = req.app.get("io");
    if (io) io.to(`order:${confirmed._id}`).emit("order:updated", {
      status: "placed", paymentStatus: "paid"
    });
    return res.status(200).json({ received: true, orderConfirmed: true });
  } catch (error) {
    // Non-2xx lets Razorpay retry transient failures.
    console.error("Razorpay webhook processing failed:", error.message);
    return res.status(500).json({ message: "Webhook processing failed. Razorpay may retry." });
  }
};
