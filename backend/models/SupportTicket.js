const mongoose = require("mongoose");
const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  senderRole: { type: String, enum: ["customer","admin","vendor","delivery"], required: true },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now }
});
const schema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  subject: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: String, enum: ["order","delivery","payment","account","other"], default: "other" },
  status: { type: String, enum: ["open","in_progress","resolved","closed"], default: "open", index: true },
  messages: { type: [messageSchema], default: [] },
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });
schema.pre("validate", function(next) {
  if (!this.ticketNumber) this.ticketNumber = `CRV-${Date.now().toString().slice(-8)}-${Math.floor(Math.random()*900+100)}`;
  next();
});
module.exports = mongoose.model("SupportTicket", schema);
