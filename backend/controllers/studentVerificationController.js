const User = require("../models/User");
const { cloudinary, isConfigured } = require("../config/cloudinary");
const crypto = require("crypto");

function imageToken(userId, exp) {
  return crypto.createHmac("sha256", process.env.JWT_SECRET || "").update(String(userId) + ":" + exp).digest("hex");
}
function dbImageUrl(user) {
  const exp = Math.floor(Date.now() / 1000) + 300;
  return "/api/student-verification/" + user._id + "/image?exp=" + exp + "&t=" + imageToken(user._id, exp);
}

function uploadBuffer(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      public_id: publicId,
      folder: "cravio/student-verification",
      resource_type: "image",
      type: "authenticated",
      overwrite: false,
      use_filename: false,
      unique_filename: false
    }, (error, result) => error ? reject(error) : resolve(result));
    stream.end(buffer);
  });
}

exports.submitStudentId = async (req, res, next) => {
  let uploadedPublicId;
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Choose a student ID image to upload." });
    }

    const user = await User.findById(req.user.id).select("+studentIdImagePublicId");
    if (!user) return res.status(404).json({ message: "User account not found." });
    if (user.isStudentVerified) {
      return res.status(400).json({ message: "Your student status is already verified." });
    }
    if (user.studentVerificationStatus === "pending") {
      return res.status(409).json({ message: "Your student ID is already waiting for admin review." });
    }

    const oldPublicId = user.studentIdImagePublicId;
    if (isConfigured()) {
      const publicId = `student-${user._id}-${Date.now()}`;
      const result = await uploadBuffer(req.file.buffer, publicId);
      uploadedPublicId = result.public_id;
      user.studentIdImagePublicId = result.public_id;
      user.studentIdImageFormat = result.format;
      user.studentIdImageData = undefined;
      user.studentIdImageContentType = "";
    } else {
      // Fallback (2026-11-14): no Cloudinary credentials are configured, so
      // the ID image is stored in the database and shown to admins through a
      // short-lived signed URL. Verification works with no storage account.
      user.studentIdImagePublicId = "";
      user.studentIdImageFormat = "";
      user.studentIdImageData = req.file.buffer;
      user.studentIdImageContentType = req.file.mimetype || "image/jpeg";
    }
    user.studentVerificationStatus = "pending";
    user.studentVerificationSubmittedAt = new Date();
    user.studentVerificationReviewedAt = null;
    user.studentVerificationReviewedBy = null;
    user.studentVerificationRejectionReason = "";
    await user.save();

    if (oldPublicId) {
      cloudinary.uploader.destroy(oldPublicId, { resource_type: "image", type: "authenticated" }).catch(() => {});
    }

    return res.status(201).json({
      message: "Student ID submitted. Your request is waiting for admin review.",
      status: user.studentVerificationStatus
    });
  } catch (error) {
    if (uploadedPublicId) {
      cloudinary.uploader.destroy(uploadedPublicId, { resource_type: "image", type: "authenticated" }).catch(() => {});
    }
    next(error);
  }
};

exports.getMyVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(
      "isStudentVerified studentVerificationStatus studentVerificationSubmittedAt studentVerificationReviewedAt studentVerificationRejectionReason"
    );
    if (!user) return res.status(404).json({ message: "User account not found." });
    res.json({ verification: user });
  } catch (error) { next(error); }
};

exports.getPendingVerifications = async (req, res, next) => {
  try {
    // The pending list itself must stay available even when Cloudinary is not
    // configured (I4): admins still see who is waiting; only the image URL is
    // omitted (null) until storage credentials exist.
    const users = await User.find({ studentVerificationStatus: "pending" })
      .select("+studentIdImagePublicId +studentIdImageFormat +studentIdImageContentType name email phone studentVerificationSubmittedAt")
      .sort({ studentVerificationSubmittedAt: 1 })
      .limit(100);

    const storageReady = isConfigured();
    const verifications = users.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      submittedAt: user.studentVerificationSubmittedAt,
      // Short-lived authenticated delivery URL for the admin review screen only.
      // Null when storage is not configured or no image was stored.
      imageUrl: storageReady && user.studentIdImagePublicId ? cloudinary.utils.private_download_url(
        user.studentIdImagePublicId,
        user.studentIdImageFormat || "jpg",
        {
          type: "authenticated",
          expires_at: Math.floor(Date.now() / 1000) + 300
        }
      ) : (user.studentIdImageContentType ? dbImageUrl(user) : null)
    }));
    res.json({ verifications });
  } catch (error) { next(error); }
};

exports.reviewVerification = async (req, res, next) => {
  try {
    const { decision, reason } = req.body;
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "Decision must be approved or rejected." });
    }
    if (decision === "rejected" && !String(reason || "").trim()) {
      return res.status(400).json({ message: "Please provide a reason for rejection." });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "Student account not found." });
    if (user.studentVerificationStatus !== "pending") {
      return res.status(409).json({ message: "This verification request is no longer pending." });
    }

    user.studentVerificationStatus = decision;
    user.isStudentVerified = decision === "approved";
    user.studentVerificationReviewedAt = new Date();
    user.studentVerificationReviewedBy = req.user.id;
    user.studentVerificationRejectionReason = decision === "rejected" ? String(reason).trim().slice(0, 300) : "";
    await user.save();

    res.json({
      message: decision === "approved" ? "Student verified successfully." : "Student verification rejected.",
      verification: {
        userId: user._id,
        status: user.studentVerificationStatus,
        isStudentVerified: user.isStudentVerified,
        rejectionReason: user.studentVerificationRejectionReason
      }
    });
  } catch (error) { next(error); }
};
exports.getStudentIdImage = async (req, res, next) => {
  try {
    const exp = Number(req.query.exp || 0);
    const t = String(req.query.t || "");
    if (!exp || exp < Math.floor(Date.now() / 1000)) {
      return res.status(403).json({ message: "Image link expired." });
    }
    const expected = imageToken(req.params.userId, exp);
    const a = Buffer.from(t);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).json({ message: "Invalid image link." });
    }
    const user = await User.findById(req.params.userId).select("+studentIdImageData +studentIdImageContentType");
    if (!user || !user.studentIdImageData) {
      return res.status(404).json({ message: "No stored ID image." });
    }
    res.setHeader("Content-Type", user.studentIdImageContentType || "image/jpeg");
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(user.studentIdImageData);
  } catch (error) { next(error); }
};
