const API_BASE_URL="http://localhost:5000/api";
const token=localStorage.getItem("cravio-token");
const $=id=>document.getElementById(id);
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function statusBadgeClass(status){
  if(status==="delivered"||status==="picked_up")return "badge badge-green";
  if(status==="cancelled")return "badge badge-red";
  return "badge badge-orange";
}
function money(value){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(value||0));}
function logout(){localStorage.removeItem("cravio-token");localStorage.removeItem("cravio-user");window.location.replace("login.html");}
async function loadOverview(){
  $("dashboardMessage").textContent="";
  if(!token){logout();return;}
  try{
    const meResponse=await fetch(`${API_BASE_URL}/auth/me`,{headers:{Authorization:`Bearer ${token}`}});
    const me=await meResponse.json();
    if(!meResponse.ok){logout();return;}
    if(me.user.role!=="admin"){$("dashboardMessage").textContent="This workspace is restricted to administrators.";return;}
    $("adminIdentity").textContent=`Signed in as ${me.user.name||"Administrator"}`;
    const response=await fetch(`${API_BASE_URL}/analytics/admin-overview`,{headers:{Authorization:`Bearer ${token}`}});
    const data=await response.json();
    if(response.status===401){logout();return;}
    if(!response.ok)throw new Error(data.message||"Could not load platform overview.");
    const c=data.counts||{};
    const cards=[
      ["Customers",c.totalCustomers,`${c.activeCustomers||0} active accounts`,"user"],
      ["Outlets",c.totalOutlets,`${c.activeOutlets||0} currently active`,"store"],
      ["Orders",c.totalOrders,`${c.pendingOrders||0} in progress`,"receipt"],
      ["Vendors",c.totalVendors,"Registered outlet managers","utensils"],
      ["Delivery partners",c.totalDeliveryPartners,"Registered delivery accounts","truck"],
      ["Refunds to review",c.pendingRefunds,"Requested, processing or pending","wallet"],
      ["Open support tickets",c.openTickets,"Awaiting support action","mail"],
      ["Active coupons",c.activeCoupons,"Promotional offers enabled","ticket"]
    ];
    $("metricsGrid").innerHTML=cards.map(([label,value,note,ic])=>`<article class="metric"><span class="metric-icon">${icon(ic,18)}</span><span>${esc(label)}</span><strong>${Number(value||0).toLocaleString("en-IN")}</strong><small>${esc(note)}</small></article>`).join("");
    const rows=data.recentOrders||[];
    $("recentOrders").innerHTML=rows.length?rows.map(o=>`<tr><td><strong>${esc(o.orderNumber||o.id)}</strong></td><td>${esc(o.customerName)}<br><small>${esc(o.customerEmail)}</small></td><td>${esc(o.outletName)}</td><td>${money(o.total)}</td><td><span class="status ${statusBadgeClass(String(o.status||""))}">${esc(String(o.status||"").replaceAll("_"," "))}</span></td><td>${o.createdAt?new Date(o.createdAt).toLocaleString("en-IN"):"—"}</td></tr>`).join(""):'<tr><td colspan="6">No orders found yet.</td></tr>';
    $("lastUpdated").textContent=`Updated ${new Date(data.generatedAt||Date.now()).toLocaleString("en-IN")}`;
  }catch(error){$("dashboardMessage").textContent=error.message||"Unable to load platform data.";}
}
$("refreshButton").addEventListener("click",loadOverview);
$("logoutButton").addEventListener("click",logout);
loadOverview();