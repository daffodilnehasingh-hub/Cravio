const serverless = require("serverless-http");
const mongoose = require("mongoose");
const app = require("../app");

// Netlify Functions hold no persistent connections, so there is no live
// Socket.io server here. Nothing in the request path emits socket events
// (verified: no `.emit(` in controllers/services/routes), and the frontend
// falls back to polling the order every 30s. This stub only guards the
// `app.get("io")` accessor so a future emit call degrades to a no-op.
const ioStub = {};
ioStub.to = () => ioStub;
ioStub.in = () => ioStub;
ioStub.emit = () => {};
app.set("io", ioStub);

const handler = serverless(app);

const FUNCTION_PREFIX = "/.netlify/functions/api";

// Netlify rewrites /api/* to /.netlify/functions/api/*, so without this
// Express sees the function path and none of the app's /api/* routes match.
// Direct calls already use /api/* and are left alone.
function normalizePath(event) {
  for (const key of ["path", "rawPath"]) {
    const p = event[key];
    if (typeof p !== "string") continue;
    if (p === FUNCTION_PREFIX) {
      event[key] = "/api";
    } else if (p.startsWith(FUNCTION_PREFIX + "/")) {
      event[key] = "/api" + p.slice(FUNCTION_PREFIX.length);
    }
  }
}

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set. Add it as a Netlify environment variable.");
  }
  normalizePath(event);
  // /api/health does not touch the database, so it must answer without
  // connecting. Previously every request awaited the Atlas connection first,
  // and a blocked Atlas made even the health check hang until the gateway
  // timed out (504 after ~30s).
  const isHealth = (event.path || "") === "/api/health";
  if (!isHealth && mongoose.connection.readyState !== 1) {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not set. Add it as a Netlify environment variable.");
    }
    // Fail fast: a blocked Atlas connection must surface as an error, not a
    // 30s hang. (Mongoose default serverSelectionTimeoutMS is 30000.)
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    } catch (err) {
      console.error("MongoDB connect failed:", err.message);
      return {
        statusCode: 503,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Database unavailable", detail: err.message }),
      };
    }
  }
  return handler(event, context);
};
