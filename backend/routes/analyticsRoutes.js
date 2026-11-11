const express = require("express");
const { protect, requireRole } = require("../middleware/authMiddleware");
const { getAnalyticsSummary, getAdminOverview } = require("../controllers/analyticsController");
const router = express.Router();
router.get("/summary", protect, requireRole("admin", "vendor"), getAnalyticsSummary);
router.get("/admin-overview", protect, requireRole("admin"), getAdminOverview);
module.exports = router;
