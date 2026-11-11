const API="http://localhost:5000/api",token=localStorage.getItem("cravio-token"),$=id=>document.getElementById(id);
let orders=[],outlets=[],summary=null;
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function statusBadgeClass(status){
 if(status==="delivered"||status==="picked_up")return "badge badge-green";
 if(status==="cancelled")return "badge badge-red";
 return "badge badge-orange";
}
function money(v){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(v||0));}
function logout(){localStorage.removeItem("cravio-token");localStorage.removeItem("cravio-user");location.replace("login.html");}
async function api(path,opts={}){const r=await fetch(API+path,{...opts,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...(opts.headers||{})}});const d=await r.json().catch(()=>({}));if(r.status===401){logout();throw Error("Your session has expired.");}if(!r.ok)throw Error(d.message||"Unable to load vendor workspace.");return d;}
async function loadWorkspace(){
 $("vendorMessage").textContent="";
 try{
  if(!token){logout();return;}
  const me=await api("/auth/me");
  if(me.user.role!=="vendor"){$("vendorMessage").textContent="This workspace is available to vendor accounts only.";return;}
  $("vendorIdentity").textContent=`Welcome, ${me.user.name||"Vendor"}`;
  const [analytics,orderData,outletData]=await Promise.all([
   api("/analytics/summary?days=30"),api("/orders/manage"),api("/outlets/manage/all")
  ]);
  summary=analytics;orders=orderData.orders||[];outlets=outletData.outlets||[];
  renderMetrics();renderOutlets();renderDishes();populateFilters();renderOrders();
  $("updatedAt").textContent=`Updated ${new Date(analytics.generatedAt||Date.now()).toLocaleString("en-IN")}`;
 }catch(e){$("vendorMessage").textContent=e.message;}
}
function renderMetrics(){
 const s=summary.summary||{};
 const metrics=[["Orders · 30 days",s.totalOrders||0,"receipt"],["Active orders",s.activeOrders||0,"clock"],["Sales · 30 days",money(s.grossOrderValue),"wallet"],["Average order value",money(s.averageOrderValue),"receipt"],["Completed orders",s.completedOrders||0,"check-circle"],["Cancelled orders",s.cancelledOrders||0,"x"],["Items sold",s.itemsSold||0,"package"],["Online payments collected",money(s.collectedOnline),"credit-card"],["Assigned outlets",outlets.length,"store"]];
 $("vendorMetrics").innerHTML=metrics.map(([a,b,ic])=>`<article class="metric"><span class="metric-icon">${icon(ic,18)}</span><span>${esc(a)}</span><strong>${esc(b)}</strong><small>Across your assigned outlets</small></article>`).join("");
}
function renderOutlets(){
 const performance=new Map((summary.outlets||[]).map(o=>[String(o.outletId),o]));
 const rows=outlets.map(o=>({outletId:o.outletId,name:o.name,orders:performance.get(String(o.outletId))?.orders||0,itemsSold:performance.get(String(o.outletId))?.itemsSold||0,orderValue:performance.get(String(o.outletId))?.orderValue||0,isActive:o.isActive!==false}));
 const max=Math.max(1,...rows.map(o=>Number(o.orderValue||0)));
 $("outletPerformance").innerHTML=rows.length?rows.map(o=>`<div class="outlet-performance-row"><div class="performance-head"><strong>${esc(o.name)}</strong><span>${money(o.orderValue)}</span></div><div class="performance-sub">${o.orders} orders · ${o.itemsSold} items sold · ${o.isActive?"Active":"Inactive"}</div><div class="performance-track"><div class="performance-fill" style="width:${Math.max(2,Number(o.orderValue||0)/max*100)}%"></div></div></div>`).join(""):'<p class="empty-note">No outlets are assigned to this vendor account yet. Contact the Cravio administrator.</p>';
}
function renderDishes(){
 const dishes=summary.topDishes||[],max=Math.max(1,...dishes.map(d=>d.quantity));
 $("topDishes").innerHTML=dishes.length?dishes.slice(0,8).map((d,i)=>`<div class="dish-performance-row"><div class="performance-head"><strong>${i+1}. ${esc(d.name)}</strong><span>${d.quantity} sold</span></div><div class="performance-sub">${esc(d.outletName)} · ${money(d.sales)} sales</div><div class="performance-track"><div class="performance-fill" style="width:${Math.max(2,d.quantity/max*100)}%"></div></div></div>`).join(""):'<p class="empty-note">No dish sales recorded in the last 30 days.</p>';
}
function populateFilters(){
 const current=$("outletFilter").value;
 $("outletFilter").innerHTML='<option value="all">All my outlets</option>'+outlets.map(o=>`<option value="${esc(o.outletId)}">${esc(o.name)}</option>`).join("");
 if([...$("outletFilter").options].some(o=>o.value===current))$("outletFilter").value=current;
}
function statusOptionsFor(current){const next={placed:[["accepted","Accept order"]],accepted:[["preparing","Preparing"]],preparing:[["ready","Ready for pickup"]]};return [...(next[current]||[]),["cancelled","Cancel order"]];}
function renderOrders(){
 const outletId=$("outletFilter").value,status=$("statusFilter").value;
 const filtered=orders.filter(o=>(outletId==="all"||String(o.outlet?.outletId)===outletId)&&(status==="all"||o.status===status));
 $("vendorOrders").innerHTML=filtered.length?filtered.map(o=>`<article class="vendor-order"><div class="vendor-order-top"><div><strong>${esc(o.orderNumber||o._id)} · ${esc(o.outlet?.name||"Outlet")}</strong><small>${o.createdAt?new Date(o.createdAt).toLocaleString("en-IN"):""}</small></div><span class="vendor-status ${statusBadgeClass(o.status||"")}">${esc(String(o.status||"").replaceAll("_"," "))}</span></div><div class="vendor-order-info"><span>Customer: <strong>${esc(o.customer?.name||"Customer")}</strong></span><span>Phone: ${esc(o.customer?.phone||"Not provided")}</span><span>Total: <strong>${money(o.total)}</strong></span><span>${esc(o.fulfillmentType)} · ${esc(o.paymentMethod)} (${esc(o.paymentStatus)})</span></div><div class="vendor-order-items">${(o.items||[]).map(i=>`${esc(i.name)} × ${i.quantity}`).join(" · ")}</div>${!["delivered","picked_up","cancelled"].includes(o.status)?`<div class="vendor-order-actions"><select id="status-${esc(o._id)}">${statusOptionsFor(o.status).map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select><button data-update="${esc(o._id)}" class="btn btn-sm">Update order</button></div>`:""}</article>`).join(""):'<div class="vendor-empty"><span class="empty-state-icon"><span data-icon="receipt" data-size="26"></span></span>No orders match the selected filters.</div>';
 document.querySelectorAll("[data-update]").forEach(b=>b.addEventListener("click",()=>updateOrder(b.dataset.update)));
}
async function updateOrder(id){
 const status=$(`status-${id}`).value;
 if(status==="cancelled"&&!confirm("Cancel this order? This may restore reserved stock."))return;
 try{const d=await api(`/orders/${encodeURIComponent(id)}/status`,{method:"PATCH",body:JSON.stringify({status})});$("vendorMessage").textContent=d.message||"Order updated.";await loadWorkspace();}catch(e){$("vendorMessage").textContent=e.message;}
}
$("outletFilter").addEventListener("change",renderOrders);$("statusFilter").addEventListener("change",renderOrders);$("refreshButton").addEventListener("click",loadWorkspace);$("logoutButton").addEventListener("click",logout);
loadWorkspace();