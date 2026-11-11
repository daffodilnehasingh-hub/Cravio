const express = require("express");
const { protect, requireRole } = require("../middleware/authMiddleware");
const { listCustomers, getCustomerDetails, updateCustomerStatus } = require("../controllers/adminCustomerController");
const router = express.Router();
router.use(protect, requireRole("admin"));
router.get("/", listCustomers);
router.get("/:id", getCustomerDetails);
router.patch("/:id/status", updateCustomerStatus);
module.exports = router;
