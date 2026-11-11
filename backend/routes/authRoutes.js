const express = require("express");
const rateLimit = require("express-rate-limit");
const { register, login, verifyEmail, resendEmailOtp, requestPasswordReset, resetPassword, me, updateMe } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// B18: targeted rate limiters on public auth routes only
const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });
const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false });
const resendLimiter = rateLimit({ windowMs: 60 * 1000, limit: 1, standardHeaders: "draft-7", legacyHeaders: false });
const passwordResetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 3, standardHeaders: "draft-7", legacyHeaders: false });

const router = express.Router();

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/verify-email", verifyLimiter, verifyEmail);
router.post("/resend-verification", resendLimiter, resendEmailOtp);
router.post("/request-password-reset", passwordResetLimiter, requestPasswordReset);
router.post("/reset-password", passwordResetLimiter, resetPassword);
// /me (GET and PATCH) are intentionally unthrottled so they cannot lock a user out.
router.get("/me", protect, me);
router.patch("/me", protect, updateMe);

module.exports = router;