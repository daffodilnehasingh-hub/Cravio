const express = require("express");
const { protect, requireRole } = require("../middleware/authMiddleware");
const uploadStudentId = require("../middleware/studentUpload");
const {
  submitStudentId, getMyVerification, getPendingVerifications, reviewVerification
} = require("../controllers/studentVerificationController");

const router = express.Router();
router.use(protect);
router.get("/me", getMyVerification);
router.post("/submit", (req, res, next) => {
  uploadStudentId(req, res, error => {
    if (error) return res.status(400).json({ message: error.message });
    next();
  });
}, submitStudentId);
router.get("/pending", requireRole("admin"), getPendingVerifications);
router.patch("/:userId/review", requireRole("admin"), reviewVerification);

module.exports = router;