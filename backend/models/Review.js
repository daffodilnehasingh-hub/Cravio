const mongoose = require("mongoose");
const reviewSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  outletId: { type: String, required: true, index: true },
  outletName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 500, default: "" }
}, { timestamps: true });
module.exports = mongoose.model("Review", reviewSchema);
