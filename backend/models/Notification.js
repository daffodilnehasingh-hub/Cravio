const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, maxlength: 100 },
  message: { type: String, required: true, maxlength: 300 },
  type: { type: String, enum: ["order","support","system"], default: "system" },
  link: { type: String, default: "" },
  readAt: { type: Date, default: null, index: true }
}, { timestamps: true });
schema.index({ user: 1, createdAt: -1 });
module.exports = mongoose.model("Notification", schema);
