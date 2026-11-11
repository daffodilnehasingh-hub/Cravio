const API_BASE_URL = "http://localhost:5000/api";
const token = localStorage.getItem("cravio-token");
const container = document.getElementById("managedOrders");
const message = document.getElementById("dashboardMessage");
let deliveryPartners = [];
const statusOptions = [
  ["accepted","Accept order"],["preparing","Preparing"],["ready","Ready for pickup"],
  ["out_for_delivery","Out for delivery"],["delivered","Delivered"],["picked_up","Picked up"],["cancelled","Cancel order"]
];
function statusBadgeClass(status){
  if(status==="delivered"||status==="picked_up")return "badge badge-green";
  if(status==="cancelled")return "badge badge-red";
  return "badge badge-orange";
}
function escapeHtml(value) {
  return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function money(value) {
  return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(value||0);
}
function logout() {
  localStorage.removeItem("cravio-token");localStorage.removeItem("cravio-user");
  window.location.replace("login.html");
}
async function checkAccess() {
  if (!token) { window.location.replace("login.html"); return false; }
  const response=await fetch(`${API_BASE_URL}/auth/me`,{headers:{Authorization:`Bearer ${token}`}});
  const data=await response.json();
  if (!response.ok) { logout(); return false; }
  if (!["admin","vendor"].includes(data.user.role)) {
    container.innerHTML='<div class="empty-state"><span class="empty-state-icon"><span data-icon="shield-check" data-size="26"></span></span>This dashboard is only available to Cravio admins and vendors.</div>';
    document.getElementById("roleLabel").textContent="Customer account";
    return false;
  }
  document.getElementById("roleLabel").textContent=`${data.user.role} dashboard`;
  return true;
}
function renderOrder(order) {
  const customer=order.customer||{};
  const options=statusOptions.map(([value,label])=>
    `<option value="${value}" ${order.status===value?"selected":""}>${label}</option>`).join("");
  const items=(order.items||[]).map(item=>`${escapeHtml(item.name)} × ${item.quantity}`).join("<br>");
  return `<article class="managed-card" data-order-id="${escapeHtml(order._id)}">
    <div class="managed-top"><div><strong>${escapeHtml(order.orderNumber||order._id)}</strong>
    <small>${escapeHtml(new Date(order.createdAt).toLocaleString("en-IN"))}</small></div>
    <span class="order-status ${statusBadgeClass(order.status||"placed")}">${escapeHtml((order.status||"placed").replaceAll("_"," "))}</span></div>
    <div class="managed-info"><span><b>Outlet:</b> ${escapeHtml(order.outlet?.name||"Outlet")}</span>
    <span><b>Customer:</b> ${escapeHtml(customer.name||"Customer")}</span>
    <span><b>Phone:</b> ${escapeHtml(customer.phone||"Not provided")}</span>
    <span><b>Total:</b> ${money(order.total)}</span><span><b>Type:</b> ${escapeHtml(order.fulfillmentType)}</span></div>
    <div class="managed-items">${items}</div>
    ${order.fulfillmentType==="delivery"?`<form class="assign-form" data-id="${escapeHtml(order._id)}">
      <select name="partner" aria-label="Choose delivery partner"><option value="">Assign delivery partner</option>${deliveryPartners.map(p=>`<option value="${escapeHtml(p._id)}" ${String(order.deliveryPartner?._id||order.deliveryPartner||"")===String(p._id)?"selected":""}>${escapeHtml(p.name)}</option>`).join("")}</select>
      <input name="eta" type="number" min="1" max="240" value="${escapeHtml(order.estimatedDeliveryMinutes||30)}" aria-label="Estimated minutes">
      <button type="submit" class="btn-dark btn-sm">Assign delivery</button></form>`:""}
    <form class="status-form" data-id="${escapeHtml(order._id)}">
      <select name="status" aria-label="Update order status">${options}</select>
      <button type="submit" class="btn btn-sm">Update status</button>
    </form>
  </article>`;
}
async function loadDashboard() {
  message.textContent="";container.innerHTML="<p>Loading orders...</p>";
  try {
    const allowed=await checkAccess();
    if (!allowed) return;
    const partnerResponse=await fetch(`${API_BASE_URL}/orders/delivery/partners`,{headers:{Authorization:`Bearer ${token}`}});
    const partnerData=await partnerResponse.json();
    deliveryPartners=partnerResponse.ok?(partnerData.partners||[]):[];
    const response=await fetch(`${API_BASE_URL}/orders/manage`,{headers:{Authorization:`Bearer ${token}`}});
    const data=await response.json();
    if (response.status===401) { logout(); return; }
    if (!response.ok) throw new Error(data.message||"Could not load orders.");
    const orders=data.orders||[];
    const count=(status)=>orders.filter(order=>order.status===status).length;
    document.getElementById("stats").innerHTML=[
      ["Total orders",orders.length,"receipt"],["New / placed",count("placed"),"bell"],["Preparing",count("preparing"),"flame"],["Completed",count("delivered")+count("picked_up"),"check-circle"]
    ].map(([label,value,ic])=>`<div class="stat-card"><span class="stat-icon">${icon(ic,18)}</span><span>${label}</span><strong>${value}</strong></div>`).join("");
    container.innerHTML=orders.length?orders.map(renderOrder).join(""):'<div class="empty-state"><span class="empty-state-icon"><span data-icon="receipt" data-size="26"></span></span><strong>No orders have arrived yet.</strong></div>';
    container.querySelectorAll(".status-form").forEach(form=>form.addEventListener("submit",updateStatus));
    container.querySelectorAll(".assign-form").forEach(form=>form.addEventListener("submit",assignDelivery));
  } catch(error) {
    container.innerHTML=`<div class="empty-state">${escapeHtml(error.message||"Unable to load dashboard.")}</div>`;
  }
}
async function updateStatus(event) {
  event.preventDefault();
  const form=event.currentTarget;
  const button=form.querySelector("button");
  button.disabled=true;button.textContent="Updating...";
  try {
    const response=await fetch(`${API_BASE_URL}/orders/${form.dataset.id}/status`,{
      method:"PATCH",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
      body:JSON.stringify({status:form.elements.status.value})
    });
    const data=await response.json();
    if (!response.ok) throw new Error(data.message||"Could not update status.");
    message.textContent="Order status updated successfully.";
    await loadDashboard();
  } catch(error) { message.textContent=error.message||"Status update failed."; }
  finally { button.disabled=false;button.textContent="Update status"; }
}
document.getElementById("refreshButton").addEventListener("click",loadDashboard);
document.getElementById("logoutButton").addEventListener("click",logout);
loadDashboard();

async function assignDelivery(event) {
  event.preventDefault();const form=event.currentTarget;const partner=form.elements.partner.value;
  if(!partner){message.textContent="Select a delivery partner first.";return;}
  try{const response=await fetch(`${API_BASE_URL}/orders/${form.dataset.id}/assign-delivery`,{
    method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
    body:JSON.stringify({deliveryPartnerId:partner,estimatedDeliveryMinutes:Number(form.elements.eta.value)})});
    const data=await response.json();if(!response.ok)throw Error(data.message||"Could not assign delivery.");
    message.textContent="Delivery partner assigned.";await loadDashboard();
  }catch(error){message.textContent=error.message;}
}
