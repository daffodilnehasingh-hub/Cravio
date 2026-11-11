const API = "http://localhost:5000/api";
const token = localStorage.getItem("cravio-token");
const queue = document.getElementById("refundQueue");
const message = document.getElementById("refundMessage");
const headers = { Authorization: `Bearer ${token}` };

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function money(value) {
  return new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:2 }).format(Number(value || 0));
}
function logout() {
  localStorage.removeItem("cravio-token"); localStorage.removeItem("cravio-user");
  window.location.replace("login.html");
}
function refundBadgeClass(status){
  if(status==="completed")return "badge badge-green";
  if(status==="failed"||status==="rejected")return "badge badge-red";
  if(status==="processing")return "badge badge-gold";
  return "badge badge-orange";
}
function renderRefund(order) {
  const refund = order.refund || {};
  const customer = order.customer || {};
  const canReject = refund.status === "requested";
  const canApprove = ["requested", "processing", "failed"].includes(refund.status);
  return `<article class="refund-card" data-order-id="${esc(order._id)}">
    <div class="refund-card-head">
      <div><strong>${esc(order.orderNumber || order._id)}</strong><small>${esc(order.outlet?.name || "Outlet")} · ${new Date(refund.requestedAt || order.createdAt).toLocaleString("en-IN")}</small></div>
      <span class="refund-tag ${refundBadgeClass(refund.status)}">${esc(refund.status)}</span>
    </div>
    <div class="refund-facts">
      <span><b>Customer</b>${esc(customer.name || "Customer")} (${esc(customer.email || "No email")})</span>
      <span><b>Amount</b>${money(refund.amount || order.total)}</span>
      <span><b>Payment ID</b>${esc(order.razorpayPaymentId || "—")}</span>
      <span><b>Reason</b>${esc(refund.reason || "—")}</span>
      ${refund.razorpayRefundId ? `<span><b>Razorpay refund</b>${esc(refund.razorpayRefundId)}</span>` : ""}
      ${refund.adminNote ? `<span><b>Previous note</b>${esc(refund.adminNote)}</span>` : ""}
    </div>
    <label class="refund-note-label">Admin note (optional)
      <textarea class="refund-admin-note" maxlength="500" rows="2" placeholder="Reason for decision or processing note..."></textarea>
    </label>
    <div class="refund-actions">
      ${canApprove ? `<button type="button" class="btn btn-sm" data-action="approve">${refund.status==="processing"||refund.status==="failed"?"Retry refund":"Approve & issue refund"}</button>` : ""}
      ${canReject ? `<button type="button" class="reject btn-danger btn-sm" data-action="reject">Reject request</button>` : ""}
    </div>
  </article>`;
}
async function loadRefunds() {
  if (!token) { logout(); return; }
  queue.textContent = "Loading refund requests...";
  try {
    const response = await fetch(`${API}/orders/refunds/manage`, { headers });
    const data = await response.json();
    if (response.status === 401) { logout(); return; }
    if (response.status === 403) throw new Error("Admin access only.");
    if (!response.ok) throw new Error(data.message || "Could not load refund requests.");
    const rows = data.refunds || [];
    queue.innerHTML = rows.length ? rows.map(renderRefund).join("") :
      '<div class="refund-empty"><span class="empty-state-icon"><span data-icon="wallet" data-size="26"></span></span>There are no refund requests awaiting review.</div>';
    queue.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", reviewRefund));
  } catch (error) {
    queue.textContent = error.message || "Unable to load refund requests.";
  }
}
async function reviewRefund(event) {
  const button = event.currentTarget;
  const card = button.closest(".refund-card");
  const action = button.dataset.action;
  if (action === "approve" && !window.confirm("Initiate a full refund through Razorpay? This action sends a real refund request in the configured Razorpay mode.")) return;
  if (action === "reject" && !window.confirm("Reject this refund request?")) return;
  button.disabled = true;
  try {
    const response = await fetch(`${API}/orders/refunds/${encodeURIComponent(card.dataset.orderId)}/review`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ action, adminNote: card.querySelector(".refund-admin-note").value.trim() })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Refund action failed.");
    message.textContent = data.message || "Refund request updated.";
    await loadRefunds();
  } catch (error) {
    message.textContent = error.message || "Unable to process refund.";
    button.disabled = false;
  }
}
document.getElementById("refreshRefunds").addEventListener("click", loadRefunds);
loadRefunds();
