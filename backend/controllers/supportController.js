const notify = require("../utils/createNotification");
const SupportTicket = require("../models/SupportTicket");
const Order = require("../models/Order");

exports.createTicket = async (req, res, next) => {
  try {
    const { subject, category = "other", message, orderId } = req.body;
    if (!subject || !String(subject).trim() || !message || !String(message).trim())
      return res.status(400).json({ message: "Enter a subject and describe your issue." });
    if (!["order","delivery","payment","account","other"].includes(category))
      return res.status(400).json({ message: "Choose a valid support category." });
    let order = null;
    if (orderId) {
      order = await Order.findOne({ _id: orderId, customer: req.user.id });
      if (!order) return res.status(404).json({ message: "The selected order was not found." });
    }
    const ticket = await SupportTicket.create({
      customer: req.user.id, order: order?._id || null,
      subject: String(subject).trim().slice(0,100), category,
      messages: [{ sender: req.user.id, senderRole: "customer", message: String(message).trim().slice(0,2000) }]
    });
    res.status(201).json({ message: "Support request submitted.", ticket });
  } catch (error) { next(error); }
};

exports.getMyTickets = async (req, res, next) => {
  try {
    const tickets = await SupportTicket.find({ customer: req.user.id }).sort({ lastMessageAt: -1 }).populate("order", "orderNumber status");
    res.json({ tickets });
  } catch (error) { next(error); }
};

exports.getAllTickets = async (req, res, next) => {
  try {
    const tickets = await SupportTicket.find().sort({ lastMessageAt: -1 }).limit(300)
      .populate("customer", "name email").populate("order", "orderNumber status");
    res.json({ tickets });
  } catch (error) { next(error); }
};

exports.replyToTicket = async (req, res, next) => {
  try {
    const { message, status } = req.body;
    if (!message || !String(message).trim() || String(message).length > 2000)
      return res.status(400).json({ message: "Reply must contain 1–2000 characters." });
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Support ticket not found." });
    if (req.user.role !== "admin" && String(ticket.customer) !== req.user.id)
      return res.status(403).json({ message: "You cannot access this ticket." });
    if (req.user.role !== "admin" && ["resolved","closed"].includes(ticket.status))
      return res.status(400).json({ message: "This ticket is closed. Create a new request for further help." });
    ticket.messages.push({ sender: req.user.id, senderRole: req.user.role, message: String(message).trim() });
    if (req.user.role === "admin") {
      if (status && !["open","in_progress","resolved","closed"].includes(status))
        return res.status(400).json({ message: "Invalid ticket status." });
      ticket.status = status || "in_progress";
    }
    ticket.lastMessageAt = new Date();
    await ticket.save();
    if (req.user.role === "admin") await notify(ticket.customer, "Support replied", `Cravio support replied to ${ticket.ticketNumber}.`, "support", "support.html");
    res.json({ message: "Reply added.", ticket });
  } catch (error) { next(error); }
};
