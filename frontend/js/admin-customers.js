const API_BASE_URL="http://localhost:5000/api";
const token=localStorage.getItem("cravio-token");
const $=id=>document.getElementById(id);
let page=1,pages=1,selectedId=null,searchTimer=null;
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function money(value){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(value||0));}
function logout(){localStorage.removeItem("cravio-token");localStorage.removeItem("cravio-user");window.location.replace("login.html");}
async function api(path,options={}){
 const response=await fetch(`${API_BASE_URL}${path}`,{...options,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...(options.headers||{})}});
 const data=await response.json().catch(()=>({}));
 if(response.status===401){logout();throw new Error("Your session has expired.");}
 if(!response.ok)throw new Error(data.message||"Request failed.");
 return data;
}
async function checkAdmin(){
 if(!token){logout();return false;}
 const data=await api("/auth/me");
 if(data.user.role!=="admin"){ $("customerMessage").textContent="This workspace is restricted to administrators.";return false; }
 return true;
}
async function loadCustomers(){
 $("customerMessage").textContent="";
 try{
  const params=new URLSearchParams({page:String(page),limit:"15",search:$("searchInput").value.trim(),status:$("statusFilter").value});
  const data=await api(`/admin/customers?${params}`);
  pages=Math.max(1,data.pagination.pages||1);
  $("resultCount").textContent=`${data.pagination.total} accounts`;
  $("pageLabel").textContent=`Page ${page} of ${pages}`;
  $("previousPage").disabled=page<=1;$("nextPage").disabled=page>=pages;
  $("customerList").innerHTML=data.customers.length?data.customers.map(c=>`<button class="customer-row ${selectedId===c.id?"selected":""}" data-id="${esc(c.id)}"><span class="customer-main"><strong>${esc(c.name)}</strong><small>${esc(c.email)}${c.phone?" · "+esc(c.phone):""}</small><small>${c.emailVerified?"Email verified":"Email not verified"} · ${c.isStudentVerified?"Student verified":"Student not verified"}</small></span><span class="customer-meta"><strong>${money(c.totalSpent)}</strong><small>${c.orderCount} orders</small><br><span class="pill ${c.isActive?"":"off"} badge ${c.isActive?"badge-green":"badge-red"}">${c.isActive?"Active":"Inactive"}</span></span></button>`).join(""):'<div class="empty-state"><span class="empty-state-icon"><span data-icon="user" data-size="26"></span></span>No customers match this search.</div>';
  document.querySelectorAll(".customer-row").forEach(button=>button.addEventListener("click",()=>loadDetails(button.dataset.id)));
 }catch(error){$("customerMessage").textContent=error.message;}
}
async function loadDetails(id){
 selectedId=id;
 document.querySelectorAll(".customer-row").forEach(b=>b.classList.toggle("selected",b.dataset.id===id));
 $("customerDetails").innerHTML='<div class="empty-state"><span class="empty-state-icon"><span data-icon="user" data-size="26"></span></span>Loading customer details…</div>';
 try{
  const data=await api(`/admin/customers/${encodeURIComponent(id)}`);
  const c=data.customer;
  $("customerDetails").innerHTML=`<div class="detail-head"><div><h2>${esc(c.name)}</h2><p>${esc(c.email)}</p></div><span class="pill ${c.isActive?"":"off"} badge ${c.isActive?"badge-green":"badge-red"}">${c.isActive?"Active":"Inactive"}</span></div>
  <div class="detail-actions"><button id="toggleStatus" class="${c.isActive?"btn-danger btn":"btn btn-ghost"}">${c.isActive?"Deactivate account":"Activate account"}</button></div>
  <div class="summary-grid"><div class="summary-box"><span>Orders</span><strong>${data.summary.orders}</strong></div><div class="summary-box"><span>Total spent*</span><strong>${money(data.summary.totalSpent)}</strong></div></div>
  <div class="detail-info"><strong>Phone:</strong> ${esc(c.phone||"Not provided")}<br><strong>Email:</strong> ${c.emailVerified?"Verified":"Not verified"}<br><strong>Student status:</strong> ${esc(c.studentVerificationStatus.replaceAll("_"," "))}<br><strong>Joined:</strong> ${c.createdAt?new Date(c.createdAt).toLocaleDateString("en-IN"):"—"}</div>
  <div class="detail-orders"><h3>Recent order history</h3>${data.orders.length?data.orders.map(o=>`<article class="order-card"><div class="order-card-head"><strong>${esc(o.orderNumber)}</strong><strong>${money(o.total)}</strong></div><p>${esc(o.outletName)} · ${esc(o.status.replaceAll("_"," "))} · ${o.createdAt?new Date(o.createdAt).toLocaleDateString("en-IN"):""}</p><p>${esc(o.items.join(", "))}</p><small>${esc(o.paymentMethod)} · ${esc(o.paymentStatus)} · ${esc(o.fulfillmentType)}</small></article>`).join(""):'<p class="empty-state"><span class="empty-state-icon"><span data-icon="receipt" data-size="24"></span></span>No orders recorded for this customer.</p>'}</div>
  <p class="detail-info">*Total spent excludes cancelled orders. Only the latest 30 orders are displayed.</p>`;
  $("toggleStatus").addEventListener("click",()=>changeStatus(c.id,!c.isActive));
 }catch(error){$("customerDetails").innerHTML=`<p>${esc(error.message)}</p>`;}
}
async function changeStatus(id,isActive){
 const action=isActive?"activate":"deactivate";
 if(!window.confirm(`Are you sure you want to ${action} this customer account?`))return;
 try{
  const data=await api(`/admin/customers/${encodeURIComponent(id)}/status`,{method:"PATCH",body:JSON.stringify({isActive})});
  $("customerMessage").textContent=data.message;
  await loadCustomers();await loadDetails(id);
 }catch(error){$("customerMessage").textContent=error.message;}
}
function runSearch(){page=1;loadCustomers();}
$("searchButton").addEventListener("click",runSearch);
$("resetButton").addEventListener("click",()=>{$("searchInput").value="";$("statusFilter").value="all";page=1;loadCustomers();});
$("statusFilter").addEventListener("change",runSearch);
$("searchInput").addEventListener("keydown",e=>{if(e.key==="Enter")runSearch();});
$("previousPage").addEventListener("click",()=>{if(page>1){page--;loadCustomers();}});
$("nextPage").addEventListener("click",()=>{if(page<pages){page++;loadCustomers();}});
$("logoutButton").addEventListener("click",logout);
(async()=>{try{if(await checkAdmin())await loadCustomers();}catch(error){$("customerMessage").textContent=error.message;}})();