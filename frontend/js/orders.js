const API_BASE_URL = "http://localhost:5000/api";
const token = localStorage.getItem("cravio-token");
const list = document.getElementById("ordersList");
const message = document.getElementById("orderMessage");

const steps = [
  ["placed", "Order placed"],
  ["accepted", "Accepted by outlet"],
  ["preparing", "Preparing your food"],
  ["ready", "Ready"],
  ["out_for_delivery", "Out for delivery"],
  ["delivered", "Delivered"],
  ["picked_up", "Picked up"]
];
const labels = {
  placed:"Order placed", accepted:"Accepted", preparing:"Preparing",
  ready:"Ready", out_for_delivery:"Out for delivery", delivered:"Delivered",
  picked_up:"Picked up", cancelled:"Cancelled"
};
function money(value) {
  return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(value||0);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function timeline(order) {
  const history = order.statusHistory || [];
  if (order.status === "cancelled") {
    return `<div class="tracking-cancelled">${icon("x",14)} Order cancelled</div>`;
  }
  const pickup = order.fulfillmentType === "pickup";
  const relevant = pickup ? steps.filter(s => !["out_for_delivery","delivered"].includes(s[0])) :
    steps.filter(s => s[0] !== "picked_up");
  const currentIndex = relevant.findIndex(s => s[0] === order.status);
  return `<ol class="tracking-timeline">${relevant.map((step,index)=>{
    const event = history.find(h=>h.status===step[0]);
    const done = index <= currentIndex;
    return `<li class="${done?"done":""}">
      <span class="timeline-dot"></span>
      <div><strong>${step[1]}</strong>
      ${event?`<small>${escapeHtml(new Date(event.changedAt).toLocaleString("en-IN"))}</small>`:""}
      ${event && event.note?`<small>${escapeHtml(event.note)}</small>`:""}</div>
    </li>`;
  }).join("")}</ol>`;
}
function statusBadgeClass(status) {
  if (status === "cancelled") return "badge-red";
  if (["delivered","picked_up"].includes(status)) return "badge-green";
  return "badge-orange";
}
function renderOrder(order) {
  const items = (order.items||[]).map(item=>`${escapeHtml(item.name)} × ${item.quantity}`).join("<br>");
  return `<article class="order-card card">
    <div class="order-head">
      <div><div class="order-number">${icon("receipt",13)} ${escapeHtml(order.orderNumber||order._id)}</div>
      <div class="order-date">${escapeHtml(new Date(order.createdAt).toLocaleString("en-IN"))}</div></div>
      <span class="order-status badge ${statusBadgeClass(order.status)}">${escapeHtml(labels[order.status]||order.status)}</span>
    </div>
    <div class="order-meta"><span>${icon("store",13)} ${escapeHtml(order.outlet?.name||"Cravio outlet")}</span>
    <span>${order.fulfillmentType==="delivery"?icon("truck",13):icon("store",13)} ${escapeHtml(order.fulfillmentType||"pickup")}</span><span class="order-total">${money(order.total)}</span></div>
    <div class="order-items">${items}</div>
    <details class="tracking-details"><summary>Order progress</summary>${timeline(order)}</details>
    ${order.status!=="payment_pending" ? `<p class="track-order-link"><a href="track-order.html?id=${encodeURIComponent(order._id)}"><span class="ci" data-icon="locate" data-size="13"></span> Track full order progress</a></p>` : ""}
    ${["delivered","picked_up"].includes(order.status) && !order.reviewed ? `<form class="review-form" data-order-id="${escapeHtml(order._id)}">
      <strong>Rate your experience</strong>
      <select name="rating" required aria-label="Rating"><option value="">Choose rating</option><option value="5">5 · Excellent</option><option value="4">4 · Good</option><option value="3">3 · Average</option><option value="2">2 · Poor</option><option value="1">1 · Bad</option></select>
      <textarea name="comment" maxlength="500" placeholder="Write a short review (optional)"></textarea>
      <button type="submit" class="btn-dark btn-sm">${icon("star",13)} Submit review</button></form>` : order.reviewed ? `<p class="review-done">${icon("check-circle",14)} You reviewed this order</p>` : ""}
    <p><a href="reviews.html?outletId=${encodeURIComponent(order.outlet?.outletId||"")}">Read outlet reviews <span class="ci" data-icon="arrow-right" data-size="13"></span></a></p>
    <div class="order-actions">
      <a class="btn-ghost btn-sm" href="receipt.html?id=${encodeURIComponent(order._id)}">${icon("receipt",13)} View receipt</a>
      <button type="button" class="btn-dark btn-sm" data-reorder="${escapeHtml(order._id)}">${icon("bag",13)} Order again</button>
      ${order.status==="placed"?`<button type="button" class="btn-danger btn-sm cancel-order" data-cancel="${escapeHtml(order._id)}">${icon("x",13)} Cancel order</button>`:""}
    </div>
    <div class="order-date">${icon("wallet",12)} Payment: ${escapeHtml(order.paymentMethod||"cod")} · ${escapeHtml(order.paymentStatus||"pending")}</div>
    ${order.refund?.status ? `<div class="refund-status">Refund: <strong>${escapeHtml(order.refund.status)}</strong>${order.refund.razorpayRefundId?` · ${escapeHtml(order.refund.razorpayRefundId)}`:""}${order.refund.adminNote?`<br><small>${escapeHtml(order.refund.adminNote)}</small>`:""}</div>` :
      (order.paymentMethod==="razorpay" && order.paymentStatus==="paid" && ["cancelled","delivered","picked_up"].includes(order.status)
        ? `<button type="button" class="btn-ghost btn-sm refund-request-button" data-refund="${escapeHtml(order._id)}">${icon("wallet",13)} Request full refund</button>` : "")}
  </article>`;
}
async function loadOrders() {
  if (!token) { window.location.replace("login.html"); return; }
  const placed = new URLSearchParams(window.location.search).get("placed");
  if (placed) message.textContent = `Your order ${placed} was placed successfully!`;
  list.innerHTML = '<p class="muted">Refreshing your orders...</p>';
  try {
    const response = await fetch(`${API_BASE_URL}/orders/my`,{headers:{Authorization:`Bearer ${token}`}});
    const data = await response.json();
    if (response.status===401) {
      localStorage.removeItem("cravio-token");localStorage.removeItem("cravio-user");
      window.location.replace("login.html");return;
    }
    if (!response.ok) throw new Error(data.message||"Could not load your orders.");
    window.currentOrders=data.orders||[];
    if (!data.orders?.length) {
      list.innerHTML='<div class="order-empty empty-state"><span class="empty-state-icon"><span data-icon="bag" data-size="28"></span></span><strong>No orders yet</strong><p>Your first delicious order is waiting. Explore Cravio outlets and place it!</p><a class="btn" href="index.html">Explore outlets</a></div>';
      return;
    }
    list.innerHTML=data.orders.map(renderOrder).join("");
    list.querySelectorAll(".review-form").forEach(form=>form.addEventListener("submit",submitReview));
    list.querySelectorAll("[data-cancel]").forEach(button=>button.addEventListener("click",cancelOrder));
    list.querySelectorAll("[data-reorder]").forEach(button=>button.addEventListener("click",reorder));
    list.querySelectorAll("[data-refund]").forEach(button=>button.addEventListener("click",requestRefund));
  } catch(error) {
    list.innerHTML=`<div class="order-empty empty-state"><span class="empty-state-icon"><span data-icon="alert" data-size="28"></span></span><strong>Could not load orders</strong><p>${escapeHtml(error.message||"Something went wrong. Please try again.")}</p><button type="button" class="btn-ghost" onclick="loadOrders()">Try again</button></div>`;
  }
}
loadOrders();

async function submitReview(event) {
  event.preventDefault();
  const form=event.currentTarget;
  try {
    const response=await fetch(`${API_BASE_URL}/reviews`,{method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
      body:JSON.stringify({orderId:form.dataset.orderId,rating:Number(form.elements.rating.value),comment:form.elements.comment.value})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.message||"Could not submit review.");
    message.textContent=data.message||"Review submitted.";
    await loadOrders();
  } catch(error) { message.textContent=error.message; }
}

async function cancelOrder(event) {
  const id=event.currentTarget.dataset.cancel;
  const reason=window.prompt("Why are you cancelling? (Optional, up to 300 characters)")||"";
  if(reason.length>300){message.textContent="Please keep the reason under 300 characters.";return;}
  if(!window.confirm("Cancel this order? This action cannot be undone."))return;
  try{
    const response=await fetch(`${API_BASE_URL}/orders/${id}/cancel`,{method:"PATCH",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
      body:JSON.stringify({reason})});
    const data=await response.json();if(!response.ok)throw Error(data.message||"Could not cancel order.");
    message.textContent=data.message;await loadOrders();
  }catch(error){message.textContent=error.message;}
}
function reorder(event) {
  const id=event.currentTarget.dataset.reorder;
  const order=window.currentOrders?.find(o=>String(o._id)===String(id));
  if(!order){message.textContent="Could not find this order. Refresh and try again.";return;}
  if(!window.confirm("Replace your current cart with these items?"))return;
  const cart=(order.items||[]).map(item=>({id:String(item.itemId),outletId:String(order.outlet.outletId),name:item.name,price:Number(item.unitPrice),quantity:Number(item.quantity)}));
  if(!cart.length||cart.some(item=>!item.id||!item.outletId||!Number.isFinite(item.price)||!Number.isInteger(item.quantity)||item.quantity<1)){message.textContent="Some items are no longer available for quick reorder. Please open the menu.";return;}
  localStorage.setItem("cravio-cart",JSON.stringify(cart));
  window.location.href=`menu.html?id=${encodeURIComponent(order.outlet.outletId)}`;
}


async function requestRefund(event) {
  const button = event.currentTarget;
  const reason = window.prompt("Please explain why you are requesting a refund (maximum 500 characters):") || "";
  if (!reason.trim()) { message.textContent = "A refund reason is required."; return; }
  if (reason.trim().length > 500) { message.textContent = "Please keep the reason under 500 characters."; return; }
  if (!window.confirm("Submit a full refund request for this paid order? The request will be reviewed by Cravio.")) return;
  button.disabled = true;
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(button.dataset.refund)}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: reason.trim() })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Could not submit refund request.");
    message.textContent = data.message || "Refund request submitted.";
    await loadOrders();
  } catch (error) {
    message.textContent = error.message || "Unable to submit refund request.";
    button.disabled = false;
  }
}
