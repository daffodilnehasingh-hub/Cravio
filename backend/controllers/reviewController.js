const Review = require("../models/Review");
const Order = require("../models/Order");
const outlets = require("../config/catalogue");

exports.createReview = async (req, res, next) => {
  try {
    const { orderId, rating, comment } = req.body;
    const score = Number(rating);
    if (!orderId || !Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ message: "Select an order and give a rating from 1 to 5." });
    }
    const order = await Order.findOne({ _id: orderId, customer: req.user.id });
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (!["delivered", "picked_up"].includes(order.status)) {
      return res.status(400).json({ message: "You can review an order only after it is delivered or picked up." });
    }
    const existing = await Review.findOne({ order: order._id });
    if (existing) return res.status(409).json({ message: "You have already reviewed this order." });
    const review = await Review.create({
      order: order._id, customer: req.user.id,
      outletId: order.outlet.outletId, outletName: order.outlet.name,
      rating: score, comment: String(comment || "").trim().slice(0, 500)
    });
    res.status(201).json({ message: "Thank you for reviewing your order!", review });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "This order has already been reviewed." });
    next(error);
  }
};

exports.getOutletReviews = async (req, res, next) => {
  try {
    const outletId = String(req.params.outletId);
    if (!outlets[outletId]) return res.status(404).json({ message: "Outlet not found." });
    const reviews = await Review.find({ outletId }).populate("customer", "name").sort({ createdAt: -1 }).limit(100);
    const stats = await Review.aggregate([
      { $match: { outletId } },
      { $group: { _id: "$outletId", averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } }
    ]);
    res.json({ outlet: { outletId, name: outlets[outletId].name }, averageRating: stats[0]?.averageRating || 0, reviewCount: stats[0]?.reviewCount || 0, reviews });
  } catch (error) { next(error); }
};

exports.getMyReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ customer: req.user.id }).sort({ createdAt: -1 });
    res.json({ reviews });
  } catch (error) { next(error); }
};

exports.getReviewSummaries = async (req, res, next) => {
  try {
    const summaries = await Review.aggregate([
      { $group: { _id: "$outletId", averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } }
    ]);
    res.json({ summaries });
  } catch (error) { next(error); }
};
