const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1, max: 50 },
  unitPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
  isVeg: { type: Boolean, default: true }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  outlet: {
    outletId: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["restaurant", "canteen"], default: "restaurant" }
  },
  items: { type: [orderItemSchema], validate: v => Array.isArray(v) && v.length > 0 },
  fulfillmentType: { type: String, enum: ["delivery", "pickup"], required: true },
  deliveryAddress: {
    fullName: String,
    phone: String,
    pincode: String,
    house: String,
    area: String,
    landmark: String
  },
  paymentMethod: { type: String, enum: ["cod", "upi", "outlet", "razorpay"], required: true },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
  stockDeducted: { type: Boolean, default: false },
  razorpayOrderId: { type: String, default: "", index: true },
  razorpayPaymentId: { type: String, default: "" },
  paymentPendingExpiresAt: { type: Date, default: null, index: true },
  refund: {
    status: { type: String, enum: ["requested", "processing", "pending", "processed", "failed", "rejected"], default: null },
    reason: { type: String, trim: true, maxlength: 500, default: "" },
    adminNote: { type: String, trim: true, maxlength: 500, default: "" },
    amount: { type: Number, min: 0, default: 0 },
    razorpayRefundId: { type: String, default: "" },
    idempotencyKey: { type: String, default: "" },
    requestedAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null }
  },
  subtotal: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  deliveryFee: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  couponCode: { type: String, default: "" },
  studentDiscountApplied: { type: Boolean, default: false },
  rewardPointsRedeemed: { type: Number, min: 0, default: 0 },
  rewardPointsAwarded: { type: Number, min: 0, default: 0 },
  rewardPointsAwardedAt: { type: Date, default: null },
  rewardPointsRestoredAt: { type: Date, default: null },
  deliveryPartner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  estimatedDeliveryMinutes: { type: Number, min: 1, max: 240, default: null },
  estimatedPreparationMinutes: { type: Number, min: 1, max: 240, default: null },
  acceptedAt: { type: Date, default: null },
  preparingAt: { type: Date, default: null },
  readyAt: { type: Date, default: null },
  deliveryAssignedAt: { type: Date, default: null },
  deliveryLocation: {
    lat: { type: Number, min: -90, max: 90, default: null },
    lng: { type: Number, min: -180, max: 180, default: null },
    updatedAt: { type: Date, default: null }
  },
  deliveredAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancellationReason: { type: String, trim: true, maxlength: 300, default: "" },
  status: {
    type: String,
    enum: ["payment_pending", "placed", "accepted", "preparing", "ready", "out_for_delivery", "delivered", "picked_up", "cancelled"],
    default: "placed",
    index: true
  },
  statusHistory: [{
    status: String,
    note: String,
    changedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

orderSchema.pre("validate", function(next) {
  if (!this.orderNumber) {
    this.orderNumber = `CRV${Date.now().toString().slice(-8)}${Math.floor(100 + Math.random() * 900)}`;
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);