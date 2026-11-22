const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const { areRealCredentials } = require("../utils/credentials");

function isConfigured() {
  // Placeholder/demo values (e.g. the public "demo" cloud) count as NOT
  // configured so callers return a clean 503 instead of a failed upload 500.
  return areRealCredentials(
    process.env.CLOUDINARY_CLOUD_NAME,
    process.env.CLOUDINARY_API_KEY,
    process.env.CLOUDINARY_API_SECRET
  );
}

module.exports = { cloudinary, isConfigured };