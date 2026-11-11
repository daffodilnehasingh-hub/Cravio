const User = require("../models/User");

function cleanAddress(body = {}) {
  return {
    label: ["Home", "Hostel", "Work", "Other"].includes(body.label) ? body.label : "Other",
    fullName: String(body.fullName || "").trim(),
    phone: String(body.phone || "").replace(/\D/g, ""),
    pincode: String(body.pincode || "").replace(/\D/g, ""),
    house: String(body.house || "").trim(),
    area: String(body.area || "").trim()
  };
}
function validate(a) {
  if (a.fullName.length < 2 || a.fullName.length > 80) return "Enter a valid full name.";
  if (!/^\d{10}$/.test(a.phone)) return "Phone number must contain 10 digits.";
  if (!/^\d{6}$/.test(a.pincode)) return "PIN code must contain 6 digits.";
  if (!a.house || a.house.length > 160) return "Enter a valid house, hostel or building.";
  if (!a.area || a.area.length > 160) return "Enter a valid street, area or landmark.";
  return null;
}
exports.listAddresses = async (req, res, next) => {
  try { const user = await User.findById(req.user.id).select("savedAddresses"); res.json({ addresses: user.savedAddresses || [] }); }
  catch (e) { next(e); }
};
exports.createAddress = async (req, res, next) => {
  try {
    const address = cleanAddress(req.body); const error = validate(address);
    if (error) return res.status(400).json({ message: error });
    const user = await User.findById(req.user.id);
    if (user.savedAddresses.length >= 10) return res.status(400).json({ message: "You can save up to 10 addresses." });
    const makeDefault = req.body.isDefault === true || user.savedAddresses.length === 0;
    if (makeDefault) user.savedAddresses.forEach(a => { a.isDefault = false; });
    user.savedAddresses.push({ ...address, isDefault: makeDefault });
    await user.save(); res.status(201).json({ addresses: user.savedAddresses, message: "Address saved." });
  } catch (e) { next(e); }
};
exports.updateAddress = async (req, res, next) => {
  try {
    const address = cleanAddress(req.body); const error = validate(address);
    if (error) return res.status(400).json({ message: error });
    const user = await User.findById(req.user.id); const target = user.savedAddresses.id(req.params.addressId);
    if (!target) return res.status(404).json({ message: "Address not found." });
    if (req.body.isDefault === true) user.savedAddresses.forEach(a => { a.isDefault = false; });
    Object.assign(target, address); if (req.body.isDefault === true) target.isDefault = true;
    await user.save(); res.json({ addresses: user.savedAddresses, message: "Address updated." });
  } catch (e) { next(e); }
};
exports.deleteAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id); const target = user.savedAddresses.id(req.params.addressId);
    if (!target) return res.status(404).json({ message: "Address not found." });
    const wasDefault = target.isDefault; target.deleteOne();
    if (wasDefault && user.savedAddresses.length) user.savedAddresses[0].isDefault = true;
    await user.save(); res.json({ addresses: user.savedAddresses, message: "Address deleted." });
  } catch (e) { next(e); }
};
exports.setDefaultAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id); const target = user.savedAddresses.id(req.params.addressId);
    if (!target) return res.status(404).json({ message: "Address not found." });
    user.savedAddresses.forEach(a => { a.isDefault = String(a._id) === String(target._id); });
    await user.save(); res.json({ addresses: user.savedAddresses, message: "Default address updated." });
  } catch (e) { next(e); }
};
