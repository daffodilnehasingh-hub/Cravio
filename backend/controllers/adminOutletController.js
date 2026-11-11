const Outlet = require("../models/Outlet");
const User = require("../models/User");

exports.listOutlets = async (req, res, next) => {
  try {
    const status = String(req.query.status || "all");
    const type = String(req.query.type || "all");
    const search = String(req.query.search || "").trim().slice(0, 100);
    const filter = {};
    if (["pending", "approved", "rejected"].includes(status)) filter.approvalStatus = status;
    if (["restaurant", "canteen"].includes(type)) filter.type = type;
    if (search) filter.$or = [
      { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
      { outletId: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
      { cuisine: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }
    ];
    const [outlets, vendors] = await Promise.all([
      Outlet.find(filter).populate("managedBy", "name email").sort({ createdAt: -1 }).lean(),
      User.find({ role: "vendor", isActive: true }).select("name email managedOutletIds").sort({ name: 1 }).lean()
    ]);
    res.json({
      outlets: outlets.map(o => ({
        outletId: o.outletId, name: o.name, type: o.type, cuisine: o.cuisine || "",
        description: o.description || "", isActive: o.isActive !== false,
        approvalStatus: o.approvalStatus || "approved", approvalNote: o.approvalNote || "",
        managedBy: o.managedBy ? { id: String(o.managedBy._id), name: o.managedBy.name, email: o.managedBy.email } : null,
        menuItems: (o.items || []).length, createdAt: o.createdAt
      })),
      vendors: vendors.map(v => ({ id: String(v._id), name: v.name, email: v.email }))
    });
  } catch (error) { next(error); }
};

exports.updateOutletApproval = async (req, res, next) => {
  try {
    const approvalStatus = String(req.body.approvalStatus || "");
    const approvalNote = String(req.body.approvalNote || "").trim().slice(0, 500);
    if (!["pending", "approved", "rejected"].includes(approvalStatus)) {
      return res.status(400).json({ message: "Choose pending, approved or rejected." });
    }
    const outlet = await Outlet.findOne({ outletId: req.params.outletId });
    if (!outlet) return res.status(404).json({ message: "Outlet not found." });
    outlet.approvalStatus = approvalStatus;
    outlet.approvalNote = approvalNote;
    // Rejected outlets cannot be publicly listed or ordered from.
    if (approvalStatus !== "approved") outlet.isActive = false;
    if (approvalStatus === "approved" && req.body.activate === true) outlet.isActive = true;
    await outlet.save();
    res.json({ message: `Outlet ${approvalStatus}.`, outlet: {
      outletId: outlet.outletId, name: outlet.name, approvalStatus: outlet.approvalStatus,
      isActive: outlet.isActive, approvalNote: outlet.approvalNote
    } });
  } catch (error) { next(error); }
};

exports.updateOutletAvailability = async (req, res, next) => {
  try {
    if (typeof req.body.isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be true or false." });
    }
    const outlet = await Outlet.findOne({ outletId: req.params.outletId });
    if (!outlet) return res.status(404).json({ message: "Outlet not found." });
    if (outlet.approvalStatus === "rejected" && req.body.isActive) {
      return res.status(400).json({ message: "Approve this outlet before activating it." });
    }
    outlet.isActive = req.body.isActive;
    await outlet.save();
    res.json({ message: req.body.isActive ? "Outlet activated." : "Outlet suspended.", outlet: {
      outletId: outlet.outletId, name: outlet.name, isActive: outlet.isActive
    } });
  } catch (error) { next(error); }
};

exports.assignOutletVendor = async (req, res, next) => {
  try {
    const vendorId = req.body.vendorId === null || req.body.vendorId === "" ? null : String(req.body.vendorId);
    const outlet = await Outlet.findOne({ outletId: req.params.outletId });
    if (!outlet) return res.status(404).json({ message: "Outlet not found." });
    let vendor = null;
    if (vendorId) {
      vendor = await User.findOne({ _id: vendorId, role: "vendor", isActive: true });
      if (!vendor) return res.status(404).json({ message: "Active vendor account not found." });
    }
    const previousVendorId = outlet.managedBy ? String(outlet.managedBy) : null;
    if (previousVendorId && previousVendorId !== vendorId) {
      await User.updateOne({ _id: previousVendorId, role: "vendor" }, { $pull: { managedOutletIds: outlet.outletId } });
    }
    outlet.managedBy = vendor ? vendor._id : null;
    await outlet.save();
    if (vendor) {
      await User.updateOne({ _id: vendor._id }, { $addToSet: { managedOutletIds: outlet.outletId } });
    }
    res.json({ message: vendor ? `Outlet assigned to ${vendor.name}.` : "Vendor assignment removed.", outlet: {
      outletId: outlet.outletId, name: outlet.name,
      managedBy: vendor ? { id: String(vendor._id), name: vendor.name, email: vendor.email } : null
    } });
  } catch (error) { next(error); }
};
