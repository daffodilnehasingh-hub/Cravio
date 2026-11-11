const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 60
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 120
    },
    phone: {
      type: String,
      trim: true,
      default: ""
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    // Legacy accounts default to verified; public sign-ups explicitly start unverified.
    emailVerified: { type: Boolean, default: true },
    emailOtpHash: { type: String, select: false, default: undefined },
    emailOtpExpiresAt: { type: Date, select: false, default: undefined },
    emailOtpLastSentAt: { type: Date, select: false, default: undefined },
    emailOtpAttempts: { type: Number, select: false, default: 0 },
    passwordResetOtpHash: { type: String, select: false, default: undefined },
    passwordResetOtpExpiresAt: { type: Date, select: false, default: undefined },
    passwordResetOtpLastSentAt: { type: Date, select: false, default: undefined },
    passwordResetOtpAttempts: { type: Number, select: false, default: 0 },
    role: {
      type: String,
      enum: ["customer", "admin", "vendor", "delivery"],
      default: "customer"
    },
    managedOutletIds: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    deliveryAvailability: { type: String, enum: ["available", "busy", "offline"], default: "available" },
    deliveryVehicleType: { type: String, enum: ["bike", "scooter", "bicycle", "other"], default: "bike" },
    deliveryVehicleNumber: { type: String, trim: true, default: "" },
    deliveryEmergencyContact: { type: String, trim: true, default: "" },
    savedAddresses: [{
      label: { type: String, enum: ["Home", "Hostel", "Work", "Other"], default: "Home" },
      fullName: { type: String, trim: true, required: true, maxlength: 80 },
      phone: { type: String, trim: true, required: true, match: /^[0-9]{10}$/ },
      pincode: { type: String, trim: true, required: true, match: /^[0-9]{6}$/ },
      house: { type: String, trim: true, required: true, maxlength: 160 },
      area: { type: String, trim: true, required: true, maxlength: 160 },
      isDefault: { type: Boolean, default: false }
    }],
    favoriteOutletIds: { type: [String], default: [] },
    rewardPoints: { type: Number, min: 0, default: 0 },
    lifetimeRewardPoints: { type: Number, min: 0, default: 0 },
    isStudentVerified: {
      type: Boolean,
      default: false
    },
    studentIdImagePublicId: { type: String, select: false, default: undefined },
    studentIdImageFormat: { type: String, select: false, default: undefined },
    studentVerificationSubmittedAt: { type: Date, default: null },
    studentVerificationReviewedAt: { type: Date, default: null },
    studentVerificationReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    studentVerificationRejectionReason: { type: String, default: "" },
    studentVerificationStatus: {
      type: String,
      enum: ["not_submitted", "pending", "approved", "rejected"],
      default: "not_submitted"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);