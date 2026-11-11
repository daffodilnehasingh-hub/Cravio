const User = require("../models/User");
const outlets = require("../config/catalogue");
const Outlet = require("../models/Outlet");

exports.getFavorites = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("favoriteOutletIds");
    const ids = user?.favoriteOutletIds || [];
    const dbOutlets = await Outlet.find({ outletId: { $in: ids }, isActive: true }).select("outletId name type delivery");
    const dbMap = new Map(dbOutlets.map(o => [o.outletId, o]));
    const favorites = ids.map(id => dbMap.get(id) || (outlets[id] ? { outletId:id, ...outlets[id] } : null)).filter(Boolean);
    res.json({ favorites });
  } catch (error) { next(error); }
};

exports.addFavorite = async (req, res, next) => {
  try {
    const outletId = String(req.params.outletId);
    const exists = await Outlet.exists({ outletId, isActive: true }) || outlets[outletId];
    if (!exists) return res.status(404).json({ message: "Outlet not found." });
    await User.findByIdAndUpdate(req.user.id, { $addToSet: { favoriteOutletIds: outletId } });
    res.json({ message: "Outlet added to favorites." });
  } catch (error) { next(error); }
};

exports.removeFavorite = async (req, res, next) => {
  try {
    const outletId = String(req.params.outletId);
    await User.findByIdAndUpdate(req.user.id, { $pull: { favoriteOutletIds: outletId } });
    res.json({ message: "Outlet removed from favorites." });
  } catch (error) { next(error); }
};
