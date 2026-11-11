const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Order = require("../models/Order");

const safePartner = user => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  isActive: user.isActive !== false,
  availability: user.deliveryAvailability || "available",
  vehicleType: user.deliveryVehicleType || "bike",
  vehicleNumber: user.deliveryVehicleNumber || "",
  emergencyContact: user.deliveryEmergencyContact || "",
  createdAt: user.createdAt
});

exports.listPartners = async (req, res, next) => {
  try {
    const partners = await User.find({ role: "delivery" }).sort({ createdAt: -1 });
    const ids = partners.map(user => user._id);
    const orders = await Order.find({ deliveryPartner: { $in: ids } })
      .select("deliveryPartner status total deliveredAt createdAt");
    const stats = new Map();
    for (const order of orders) {
      const id = String(order.deliveryPartner);
      if (!stats.has(id)) stats.set(id, { assigned: 0, completed: 0, active: 0, cancelled: 0, deliveredValue: 0 });
      const row = stats.get(id);
      row.assigned += 1;
      if (order.status === "delivered") { row.completed += 1; row.deliveredValue += Number(order.total || 0); }
      else if (["cancelled"].includes(order.status)) row.cancelled += 1;
      else row.active += 1;
    }
    res.json({ partners: partners.map(user => ({
      ...safePartner(user),
      stats: stats.get(String(user._id)) || { assigned: 0, completed: 0, active: 0, cancelled: 0, deliveredValue: 0 }
    })) });
  } catch (error) { next(error); }
};

exports.createPartner = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    const password = String(req.body.password || "");
    const vehicleType = String(req.body.vehicleType || "bike");
    const vehicleNumber = String(req.body.vehicleNumber || "").trim().toUpperCase();
    const emergencyContact = String(req.body.emergencyContact || "").trim();

    if (name.length < 2 || name.length > 60 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !/^[0-9+\-\s()]{7,18}$/.test(phone) || password.length < 8 || password.length > 128 ||
        !["bike", "scooter", "bicycle", "other"].includes(vehicleType)) {
      return res.status(400).json({ message: "Enter a valid name, email, phone, password (8+ characters) and vehicle type." });
    }
    if (await User.findOne({ email })) return res.status(409).json({ message: "An account with this email already exists." });
    const partner = await User.create({
      name, email, phone, password: await bcrypt.hash(password, 12),
      role: "delivery", emailVerified: true, isActive: true,
      deliveryAvailability: "available", deliveryVehicleType: vehicleType,
      deliveryVehicleNumber: vehicleNumber, deliveryEmergencyContact: emergencyContact
    });
    res.status(201).json({ message: "Delivery partner account created.", partner: safePartner(partner) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "An account with this email already exists." });
    next(error);
  }
};

exports.updatePartner = async (req, res, next) => {
  try {
    const partner = await User.findOne({ _id: req.params.id, role: "delivery" });
    if (!partner) return res.status(404).json({ message: "Delivery partner not found." });
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length < 2 || name.length > 60) return res.status(400).json({ message: "Name must be 2–60 characters." });
      partner.name = name;
    }
    if (req.body.phone !== undefined) {
      const phone = String(req.body.phone).trim();
      if (!/^[0-9+\-\s()]{7,18}$/.test(phone)) return res.status(400).json({ message: "Enter a valid phone number." });
      partner.phone = phone;
    }
    if (req.body.vehicleType !== undefined) {
      if (!["bike", "scooter", "bicycle", "other"].includes(req.body.vehicleType)) return res.status(400).json({ message: "Invalid vehicle type." });
      partner.deliveryVehicleType = req.body.vehicleType;
    }
    if (req.body.vehicleNumber !== undefined) partner.deliveryVehicleNumber = String(req.body.vehicleNumber).trim().toUpperCase().slice(0, 24);
    if (req.body.emergencyContact !== undefined) partner.deliveryEmergencyContact = String(req.body.emergencyContact).trim().slice(0, 30);
    if (req.body.isActive === false || req.body.availability === "offline") {
      const activeOrder = await Order.exists({
        deliveryPartner: partner._id,
        status: { $in: ["ready", "out_for_delivery"] }
      });
      if (activeOrder) return res.status(409).json({ message: "This partner has an active delivery. Complete it before disabling or setting offline." });
    }
    if (req.body.isActive !== undefined) {
      partner.isActive = Boolean(req.body.isActive);
      if (!partner.isActive) partner.deliveryAvailability = "offline";
      else if (partner.deliveryAvailability === "offline") partner.deliveryAvailability = "available";
    }
    if (req.body.availability !== undefined) {
      if (!["available", "offline"].includes(req.body.availability)) return res.status(400).json({ message: "Admin can set availability to available or offline." });
      if (partner.isActive) partner.deliveryAvailability = req.body.availability;
    }
    await partner.save();
    res.json({ message: "Delivery partner updated.", partner: safePartner(partner) });
  } catch (error) { next(error); }
};

exports.updateMyAvailability = async (req, res, next) => {
  try {
    const availability = String(req.body.availability || "");
    if (!["available", "offline"].includes(availability)) {
      return res.status(400).json({ message: "Choose available or offline." });
    }
    const partner = await User.findOne({ _id: req.user.id, role: "delivery", isActive: true });
    if (!partner) return res.status(404).json({ message: "Active delivery partner account not found." });
    const activeOrder = await Order.exists({
      deliveryPartner: partner._id,
      status: { $in: ["ready", "out_for_delivery"] }
    });
    if (activeOrder && availability === "offline") {
      return res.status(409).json({ message: "Complete your active delivery before going offline." });
    }
    partner.deliveryAvailability = availability;
    await partner.save();
    res.json({ message: `You are now ${availability}.`, availability: partner.deliveryAvailability });
  } catch (error) { next(error); }
};

exports.getMyDeliveryProfile = async (req, res, next) => {
  try {
    const partner = await User.findOne({ _id: req.user.id, role: "delivery" });
    if (!partner) return res.status(404).json({ message: "Delivery partner account not found." });
    const [assigned, completed, active] = await Promise.all([
      Order.countDocuments({ deliveryPartner: partner._id }),
      Order.countDocuments({ deliveryPartner: partner._id, status: "delivered" }),
      Order.countDocuments({ deliveryPartner: partner._id, status: { $in: ["ready", "out_for_delivery"] } })
    ]);
    res.json({ partner: safePartner(partner), stats: { assigned, completed, active } });
  } catch (error) { next(error); }
};
