const API_BASE_URL = "http://localhost:5000/api";
const token = localStorage.getItem("cravio-token");
const rangeSelect = document.getElementById("rangeSelect");
const message = document.getElementById("analyticsMessage");

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
}
function logout() {
  localStorage.removeItem("cravio-token");
  localStorage.removeItem("cravio-user");
  window.location.replace("login.html");
}
async function checkAccess() {
  if (!token) { logout(); return false; }
  const response = await fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) { logout(); return false; }
  if (!["admin", "vendor"].includes(data.user.role)) {
    message.textContent = "Analytics is available to admins and vendors only.";
    document.getElementById("metricGrid").innerHTML = "";
    return false;
  }
  document.getElementById("roleLabel").textContent = `${data.user.role} analytics`;
  return true;
}
function renderMetrics(summary) {
  const metrics = [
    ["Total orders", summary.totalOrders, "receipt"],
    ["Active orders", summary.activeOrders, "clock"],
    ["Completed orders", summary.completedOrders, "check-circle"],
    ["Cancelled orders", summary.cancelledOrders, "x"],
    ["Order value", money(summary.grossOrderValue), "wallet"],
    ["Average order value", money(summary.averageOrderValue), "receipt"],
    ["Razorpay collected", money(summary.collectedOnline), "credit-card"],
    ["Items sold", summary.itemsSold, "package"]
  ];
  document.getElementById("metricGrid").innerHTML = metrics.map(([label, value, ic]) =>
    `<article class="metric-card"><span class="metric-icon">${icon(ic, 18)}</span><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`
  ).join("");
}
function renderDaily(daily) {
  const container = document.getElementById("dailyChart");
  if (!daily.length) { container.innerHTML = '<p class="empty-note">No orders in this period.</p>'; return; }
  const max = Math.max(1, ...daily.map(day => day.orderValue));
  container.innerHTML = daily.map(day => {
    const height = Math.max(day.orderValue ? 3 : 1, (day.orderValue / max) * 125);
    const label = new Date(`${day.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `<div class="day-column" title="${escapeHtml(label)} · ${money(day.orderValue)} · ${day.orders} orders">
      <div class="day-value">${day.orderValue ? escapeHtml(money(day.orderValue)) : ""}</div>
      <div class="day-bar-wrap"><div class="day-bar" style="height:${height}px"></div></div>
      <span class="day-label">${escapeHtml(label)}</span>
    </div>`;
  }).join("");
}
function renderStatuses(statusCounts) {
  const entries = Object.entries(statusCounts || {}).sort((a,b) => b[1]-a[1]);
  const max = Math.max(1, ...entries.map(entry => entry[1]));
  document.getElementById("statusBreakdown").innerHTML = entries.length ? entries.map(([status,count]) =>
    `<div><div class="status-row"><span class="status-name">${escapeHtml(status.replaceAll("_"," "))}</span><span class="status-count">${count}</span></div>
    <div class="status-track"><div class="status-fill" style="width:${count/max*100}%"></div></div></div>`
  ).join("") : '<p class="empty-note">No order activity yet.</p>';
}
function renderDishes(dishes) {
  const max = Math.max(1, ...dishes.map(dish => dish.quantity));
  document.getElementById("topDishes").innerHTML = dishes.length ? dishes.map((dish,index) =>
    `<div class="rank-row"><div class="rank-main"><div class="rank-name">${index+1}. ${escapeHtml(dish.name)}</div>
    <span class="rank-sub">${escapeHtml(dish.outletName)} · ${money(dish.sales)} sales</span>
    <div class="rank-track"><div class="rank-fill" style="width:${dish.quantity/max*100}%"></div></div></div>
    <span class="rank-value">${dish.quantity} sold</span></div>`
  ).join("") : '<p class="empty-note">No dish sales in this period.</p>';
}
function renderOutlets(outlets) {
  document.getElementById("outletPerformance").innerHTML = outlets.length ? outlets.map(outlet =>
    `<div class="outlet-row"><div><div class="outlet-name">${escapeHtml(outlet.name)}</div>
    <span class="outlet-sub">${outlet.orders} orders · ${outlet.itemsSold} items sold</span></div>
    <span class="outlet-value">${money(outlet.orderValue)}</span></div>`
  ).join("") : '<p class="empty-note">No outlet activity in this period.</p>';
}
async function loadAnalytics() {
  message.textContent = "";
  if (!await checkAccess()) return;
  try {
    const response = await fetch(`${API_BASE_URL}/analytics/summary?days=${rangeSelect.value}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (response.status === 401) { logout(); return; }
    if (!response.ok) throw new Error(data.message || "Could not load analytics.");
    renderMetrics(data.summary || {});
    renderDaily(data.daily || []);
    renderStatuses(data.statusCounts || {});
    renderDishes(data.topDishes || []);
    renderOutlets(data.outlets || []);
  } catch (error) {
    message.textContent = error.message || "Unable to load analytics.";
  }
}
document.getElementById("refreshButton").addEventListener("click", loadAnalytics);
rangeSelect.addEventListener("change", loadAnalytics);
document.getElementById("logoutButton").addEventListener("click", logout);
loadAnalytics();
