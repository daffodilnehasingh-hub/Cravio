require("dotenv").config();
const mongoose = require("mongoose");
const Outlet = require("../models/Outlet");

async function run() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing from backend/.env");
  await mongoose.connect(process.env.MONGODB_URI);
  const outlets = await Outlet.find({});
  let updated = 0;
  for (const outlet of outlets) {
    let changed = false;
    for (const item of outlet.items) {
      if (typeof item.stockQuantity !== "number" || !Number.isFinite(item.stockQuantity)) {
        item.stockQuantity = 50;
        changed = true;
      }
      if (typeof item.lowStockThreshold !== "number" || !Number.isFinite(item.lowStockThreshold)) {
        item.lowStockThreshold = 5;
        changed = true;
      }
      if (item.stockQuantity <= 0) {
        item.available = false;
        changed = true;
      }
    }
    if (changed) { await outlet.save(); updated += 1; }
  }
  console.log(`Inventory migration complete. Updated ${updated} outlet(s). Existing menu items without stock were initialized to 50 units.`);
  await mongoose.disconnect();
}
run().catch(async error => {
  console.error("Inventory migration failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
