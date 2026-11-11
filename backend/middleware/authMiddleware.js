const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.protect = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Please log in to access this resource." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id role managedOutletIds isActive");
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: "This account is unavailable. Please contact Cravio support." });
    }
    // Use current database permissions so role changes and deactivation take effect
    // even when an older JWT is still present in the browser.
    req.user = {
      id: String(user._id),
      role: user.role,
      managedOutletIds: user.managedOutletIds || []
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Your session is invalid or expired. Please log in again." });
  }
};

exports.requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "You do not have permission to access this resource." });
  }
  next();
};
