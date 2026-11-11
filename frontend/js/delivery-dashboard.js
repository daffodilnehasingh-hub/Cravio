const API="http://localhost:5000/api", token=localStorage.getItem("cravio-token");
const jobs=document.getElementById("deliveryJobs"), message=document.getElementById("deliveryMessage");
let activeWatch=null;
const headers={Authorization:`Bearer ${token}`,"Content-Type":"application/json"};
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function logout(){if(activeWatch!==null)navigator.geolocation.clearWatch(activeWatch);localStorage.removeItem("cravio-token");localStorage.removeItem("cravio-user");location.href="login.html";}
async function request(url,options={}){const r=await fetch(API+url,{...options,headers:{...headers,...options.headers}});const d=await r.json();if(!r.ok)throw Error(d.message||"Request failed");return d;}
async function setStatus(id,status){await request(`/orders/delivery/${id}/status`,{method:"PATCH",body:JSON.stringify({status})});message.textContent=status==="delivered"?"Delivery marked complete.":"Delivery started.";await load();}
function shareLocation(id){
 if(!navigator.geolocation){message.textContent="Geolocation is not supported by this browser.";return;}
 if(activeWatch!==null)navigator.geolocation.clearWatch(activeWatch);
 message.textContent="Waiting for location permission...";
 activeWatch=navigator.geolocation.watchPosition(async pos=>{
   try{await request(`/orders/delivery/${id}/location`,{method:"PATCH",body:JSON.stringify({lat:pos.coords.latitude,lng:pos.coords.longitude})});message.textContent="Live location shared with the customer.";}
   catch(e){message.textContent=e.message; navigator.geolocation.clearWatch(activeWatch);activeWatch=null;}
 },err=>{message.textContent=`Location error: ${err.message}`;if(activeWatch!==null)navigator.geolocation.clearWatch(activeWatch);activeWatch=null;},{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
}
function render(o){const address=o.deliveryAddress||{};const started=o.status==="out_for_delivery";
return `<article class="job-card"><h2>${icon("receipt",18)} ${esc(o.orderNumber||o._id)}</h2><p><b>Outlet:</b> ${esc(o.outlet?.name)}<br><b>Customer:</b> ${esc(o.customer?.name)}<br><b>Phone:</b> ${esc(o.customer?.phone||address.phone||"Not provided")}<br><b>Address:</b> ${icon("map-pin",14)} ${esc([address.house,address.area,address.landmark,address.pincode].filter(Boolean).join(", "))}<br><b>ETA:</b> ${esc(o.estimatedDeliveryMinutes||"Not set")} minutes</p>
<div class="job-actions">${!started?`<button data-start="${esc(o._id)}" class="btn btn-sm">Start delivery</button>`:`<button data-share="${esc(o._id)}" class="btn btn-sm">${icon("locate",14)} Share live location</button><button data-done="${esc(o._id)}" class="btn-dark btn-sm">Mark delivered</button>`}</div></article>`;}
async function loadProfile(){
 const data=await request("/delivery-partners/me");
 const partner=data.partner, stats=data.stats||{};
 document.getElementById("availabilityLabel").textContent=`${partner.availability} · ${partner.vehicleType} ${partner.vehicleNumber||""}`;
 document.getElementById("availabilitySelect").value=partner.availability==="offline"?"offline":"available";
 document.getElementById("deliveryProfileStats").textContent=`${stats.completed||0} completed deliveries · ${stats.active||0} active · ${stats.assigned||0} assigned`;
}
document.getElementById("availabilitySelect").addEventListener("change",async event=>{
 try{const data=await request("/delivery-partners/me/availability",{method:"PATCH",body:JSON.stringify({availability:event.target.value})});message.textContent=data.message;await loadProfile();}
 catch(error){message.textContent=error.message;await loadProfile();}
});
async function load(){if(!token){location.replace("login.html");return;}try{await loadProfile();const d=await request("/orders/delivery/my");jobs.innerHTML=d.orders.length?d.orders.map(render).join(""):'<div class="empty-state"><span class="empty-state-icon"><span data-icon="truck" data-size="26"></span></span>No active deliveries assigned to you.</div>';
jobs.querySelectorAll("[data-start]").forEach(b=>b.onclick=async()=>{try{await setStatus(b.dataset.start,"out_for_delivery");shareLocation(b.dataset.start);}catch(e){message.textContent=e.message;}});
jobs.querySelectorAll("[data-share]").forEach(b=>b.onclick=()=>shareLocation(b.dataset.share));
jobs.querySelectorAll("[data-done]").forEach(b=>b.onclick=async()=>{try{await setStatus(b.dataset.done,"delivered");if(activeWatch!==null){navigator.geolocation.clearWatch(activeWatch);activeWatch=null;}}catch(e){message.textContent=e.message;}});
}catch(e){jobs.textContent=e.message;}}
document.getElementById("logoutButton").onclick=logout;load();
