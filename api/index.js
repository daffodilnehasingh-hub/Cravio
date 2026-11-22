// Vercel serverless entry for the Cravio Express app.
// Mirrors backend/functions/api.js (Netlify): /api/health answers without
// the DB, other routes fail fast with 503 JSON when Atlas is unreachable or
// unset. Vercel calls an exported request handler directly.
const mongoose = require("mongoose");
const app = require("../backend/app");

// No persistent Socket.io server in a serverless function. Nothing in the
// request path emits socket events (verified: no `.emit(` in
// controllers/services/routes) and the frontend falls back to polling the
// order every 30s. This stub only guards the `app.get("io")` accessor.
const ioStub = {};
ioStub.to = () => ioStub;
ioStub.in = () => ioStub;
ioStub.emit = () => {};
app.set("io", ioStub);

function normalizePath(url) {
  // A rewrite to /api/index.js may surface as /api/index.js/... inside the
  // function; translate it back so Express sees the /api/* routes.
  const prefix = "/api/index.js";
  if (url === prefix) return "/api";
  if (url.startsWith(prefix + "/")) return "/api" + url.slice(prefix.length);
  return url;
}

module.exports = async (req, res) => {
  const parts = (req.url || "/").split("?");
  const rawPath = parts[0];
  const path = normalizePath(rawPath);
  if (path !== rawPath) {
    req.url = path + (parts[1] ? "?" + parts[1] : "");
  }

  const isHealth = path === "/api/health";
  if (!isHealth && mongoose.connection.readyState !== 1) {
    if (!process.env.MONGODB_URI) {
      return res.status(503).json({ error: "Database unavailable", detail: "MONGODB_URI is not set." });
    }
    // Fail fast: a blocked Atlas connection must surface as an error, not a
    // 30s hang. (Mongoose default serverSelectionTimeoutMS is 30000.)
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    } catch (err) {
      console.error("MongoDB connect failed:", err.message);
      return res.status(503).json({ error: "Database unavailable", detail: err.message });
    }
  }
  return app(req, res);
};
