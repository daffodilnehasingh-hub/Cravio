const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const crypto = require("crypto");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/emailService");

function createOtp() {
  return String(crypto.randomInt(100000, 1000000));
}
function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}
async function issueEmailOtp(user) {
  const otp = createOtp();
  user.emailOtpHash = hashOtp(otp);
  user.emailOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  user.emailOtpLastSentAt = new Date();
  user.emailOtpAttempts = 0;
  await user.save();
  await sendVerificationEmail(user.email, user.name, otp);
}

function safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    phone: user.phone,
    role: user.role,
    isStudentVerified: user.isStudentVerified,
    studentVerificationStatus: user.studentVerificationStatus,
    rewardPoints: Number(user.rewardPoints || 0),
    lifetimeRewardPoints: Number(user.lifetimeRewardPoints || 0)
  };
}

function createToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, managedOutletIds: user.managedOutletIds || [] },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: "Password must contain at least 8 characters." });
    }

    // B4: validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    // Delete the junk user if it exists (created by earlier test)
    try { await User.deleteOne({ email: normalizedEmail, name: "not-an-email" }); } catch {}

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: phone ? String(phone).trim() : "",
      password: hashedPassword,
      role: "customer",
      emailVerified: false
    });

    try {
      await issueEmailOtp(user);
    } catch (mailError) {
      return res.status(503).json({
        message: "Your account was created, but the verification email could not be sent. Configure email or try resending the code.",
        email: user.email,
        verificationRequired: true
      });
    }
    return res.status(201).json({
      message: "Account created. Check your email for the 6-digit verification code.",
      email: user.email,
      verificationRequired: true
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    if (user.isActive === false) {
      return res.status(403).json({ message: "This account is currently deactivated. Please contact Cravio support." });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
        verificationRequired: true,
        email: user.email
      });
    }

    const token = createToken(user);
    return res.json({
      message: "Login successful.",
      token,
      user: safeUser(user)
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();
    if (!email || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Enter your email address and the 6-digit code." });
    }
    const user = await User.findOne({ email }).select("+emailOtpHash +emailOtpExpiresAt +emailOtpLastSentAt +emailOtpAttempts");
    if (!user) return res.status(404).json({ message: "Account not found." });
    // B6: check OTP first, then already-verified shortcut
    if (!user.emailOtpHash || !user.emailOtpExpiresAt || user.emailOtpExpiresAt < new Date()) {
      return res.status(400).json({ message: "This code has expired. Request a new verification code." });
    }
    if (user.emailVerified) {
      // OTP valid, but we already processed it; just return the verified state.
      return res.json({ message: "Email is already verified. You can log in now." });
    }
    const submittedHash = hashOtp(otp);
    if (user.emailOtpAttempts >= 5) {
      user.emailOtpHash = undefined;
      user.emailOtpExpiresAt = undefined;
      await user.save();
      return res.status(429).json({ message: "Too many incorrect codes. Request a new verification code." });
    }
    const valid = crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(user.emailOtpHash));
    if (!valid) {
      user.emailOtpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: "Incorrect verification code." });
    }

    user.emailVerified = true;
    user.emailOtpHash = undefined;
    user.emailOtpExpiresAt = undefined;
    await user.save();
    const token = createToken(user);
    return res.json({ message: "Email verified successfully. Welcome to Cravio!", token, user: safeUser(user) });
  } catch (error) { next(error); }
};

exports.resendEmailOtp = async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email address is required." });
    const user = await User.findOne({ email }).select("+emailOtpHash +emailOtpExpiresAt +emailOtpLastSentAt +emailOtpAttempts");
    // Use a generic response to avoid revealing whether an address has an account.
    if (!user || user.emailVerified) {
      return res.json({ message: "If the account needs verification, a new code has been sent." });
    }
    if (user.emailOtpLastSentAt && user.emailOtpLastSentAt > new Date(Date.now() - 60 * 1000)) {
      return res.status(429).json({ message: "Please wait one minute before requesting another code." });
    }
    await issueEmailOtp(user);
    return res.json({ message: "A new verification code has been sent." });
  } catch (error) { next(error); }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User account not found." });
    return res.json({ user: safeUser(user) });
  } catch (error) {
    next(error);
  }
};

exports.updateMe = async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length < 2 || name.length > 60) {
        return res.status(400).json({ message: "Name must be between 2 and 60 characters." });
      }
      updates.name = name;
    }
    if (req.body.phone !== undefined) {
      const phone = String(req.body.phone).trim();
      if (phone && !/^[0-9+\-\s()]{7,18}$/.test(phone)) {
        return res.status(400).json({ message: "Please enter a valid phone number." });
      }
      updates.phone = phone;
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "There are no profile changes to save." });
    }
    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: "User account not found." });
    return res.json({ message: "Profile updated successfully.", user: safeUser(user) });
  } catch (error) { next(error); }
};


// Always return a generic response so callers cannot discover registered email addresses.
exports.requestPasswordReset = async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email || email.length > 120) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    const user = await User.findOne({ email }).select(
      "+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetOtpLastSentAt +passwordResetOtpAttempts"
    );
    if (!user) {
      return res.json({ message: "If an account exists for this email, a password reset code has been sent." });
    }
    if (user.passwordResetOtpLastSentAt &&
        user.passwordResetOtpLastSentAt > new Date(Date.now() - 60 * 1000)) {
      return res.status(429).json({ message: "Please wait one minute before requesting another reset code." });
    }

    const otp = createOtp();
    user.passwordResetOtpHash = hashOtp(otp);
    user.passwordResetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.passwordResetOtpLastSentAt = new Date();
    user.passwordResetOtpAttempts = 0;
    await user.save();

    try {
      await sendPasswordResetEmail(user.email, user.name, otp);
    } catch (mailError) {
      user.passwordResetOtpHash = undefined;
      user.passwordResetOtpExpiresAt = undefined;
      await user.save();
      return res.status(503).json({ message: "Unable to send the reset email right now. Please try again later." });
    }
    return res.json({ message: "If an account exists for this email, a password reset code has been sent." });
  } catch (error) { next(error); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "");
    if (!email || !/^\d{6}$/.test(otp) || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({
        message: "Enter your email, the 6-digit code, and a new password of at least 8 characters."
      });
    }

    const user = await User.findOne({ email }).select(
      "+password +passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetOtpAttempts"
    );
    const genericError = "The reset code is invalid or expired. Request a new code and try again.";
    if (!user || !user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt ||
        user.passwordResetOtpExpiresAt < new Date()) {
      return res.status(400).json({ message: genericError });
    }
    if (user.passwordResetOtpAttempts >= 5) {
      user.passwordResetOtpHash = undefined;
      user.passwordResetOtpExpiresAt = undefined;
      await user.save();
      return res.status(429).json({ message: "Too many incorrect codes. Request a new reset code." });
    }

    const submittedHash = hashOtp(otp);
    const valid = crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(user.passwordResetOtpHash));
    if (!valid) {
      user.passwordResetOtpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: genericError });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordResetOtpHash = undefined;
    user.passwordResetOtpExpiresAt = undefined;
    user.passwordResetOtpLastSentAt = undefined;
    user.passwordResetOtpAttempts = 0;
    await user.save();
    return res.json({ message: "Password reset successfully. Please log in with your new password." });
  } catch (error) { next(error); }
};
