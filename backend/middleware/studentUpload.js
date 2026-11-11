const multer = require("multer");

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const uploadStudentId = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!allowedTypes.has(file.mimetype)) {
      return callback(new Error("Upload a JPG, PNG or WEBP image only."));
    }
    callback(null, true);
  }
}).single("studentId");

module.exports = uploadStudentId;