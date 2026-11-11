const API="http://localhost:5000/api",token=localStorage.getItem("cravio-token");
const list=document.getElementById("partnerList"),message=document.getElementById("partnerMessage");
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function logout(){localStorage.removeItem("cravio-token");localStorage.removeItem("cravio-user");location.replace("login.html");}
async function request(url,method="GET",body){const response=await fetch(API+url,{method,headers:{Authorization:`Bearer ${token}`,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw Error(data.message||"Request failed.");return data;}
async function checkAdmin(){if(!token){logout();return false;}const me=await request("/auth/me");if(me.user.role!=="admin"){list.innerHTML='<p class="partner-panel">Only administrators can manage delivery partner accounts.</p>';document.getElementById("partnerForm").hidden=true;return false;}return true;}
function renderPartner(p){
 const stats=p.stats||{},availability=p.availability||"available";
 return `<article class="partner-card" data-id="${esc(p.id)}">
  <div><div class="partner-name">${esc(p.name)}</div><div class="partner-meta">${esc(p.email)}<br>${esc(p.phone)}<br>${esc(p.vehicleType)} · ${esc(p.vehicleNumber||"No vehicle number")}</div></div>
  <div><span class="partner-status ${esc(availability)} badge ${availability==="available"?"badge-green":availability==="busy"?"badge-gold":"badge-red"}">${esc(availability)}</span> <span class="partner-status ${p.isActive?"":"inactive"} badge ${p.isActive?"badge-green":"badge-red"}">${p.isActive?"Active account":"Disabled"}</span>
  <div class="partner-meta">Emergency: ${esc(p.emergencyContact||"Not provided")}</div></div>
  <div class="partner-meta"><b>${stats.completed||0}</b> completed · <b>${stats.active||0}</b> active<br><b>${stats.assigned||0}</b> assigned · <b>${stats.cancelled||0}</b> cancelled<br>Delivered value: ₹${Number(stats.deliveredValue||0).toFixed(0)}</div>
  <div class="partner-controls"><select class="availability"><option value="available" ${availability==="available"?"selected":""}>Available</option><option value="offline" ${availability==="offline"?"selected":""}>Offline</option></select>
   <div class="partner-actions"><button data-save class="btn btn-sm">Save</button><button class="secondary btn-ghost btn-sm" data-toggle>${p.isActive?"Disable":"Enable"}</button></div></div>
 </article>`;
}
async function load(){
 try{if(!await checkAdmin())return;const data=await request("/delivery-partners");const partners=data.partners||[];
 const available=partners.filter(p=>p.isActive&&p.availability==="available").length;
 const busy=partners.filter(p=>p.isActive&&p.availability==="busy").length;
 const offline=partners.filter(p=>!p.isActive||p.availability==="offline").length;
 const completed=partners.reduce((n,p)=>n+(p.stats?.completed||0),0);
 document.getElementById("partnerStats").innerHTML=[["Total partners",partners.length,"truck"],["Available",available,"user"],["On delivery",busy,"zap"],["Completed deliveries",completed,"check-circle"]].map(([l,v,ic])=>`<div class="partner-stat"><span class="stat-icon">${icon(ic,18)}</span><span>${l}</span><strong>${v}</strong></div>`).join("");
 list.innerHTML=partners.length?partners.map(renderPartner).join(""):'<div class="partner-panel empty-state"><span class="empty-state-icon"><span data-icon="truck" data-size="26"></span></span>No delivery partners created yet.</div>';
 list.querySelectorAll("[data-save]").forEach(b=>b.onclick=savePartner);
 list.querySelectorAll("[data-toggle]").forEach(b=>b.onclick=togglePartner);
 }catch(e){list.textContent=e.message;}
}
async function savePartner(event){const card=event.currentTarget.closest(".partner-card");try{await request(`/delivery-partners/${card.dataset.id}`,"PATCH",{availability:card.querySelector(".availability").value});message.textContent="Partner availability updated.";await load();}catch(e){message.textContent=e.message;}}
async function togglePartner(event){const card=event.currentTarget.closest(".partner-card");const button=event.currentTarget;const currentlyActive=button.textContent.trim()==="Disable";try{await request(`/delivery-partners/${card.dataset.id}`,"PATCH",{isActive:!currentlyActive});message.textContent=currentlyActive?"Partner account disabled.":"Partner account enabled.";await load();}catch(e){message.textContent=e.message;}}
document.getElementById("partnerForm").addEventListener("submit",async event=>{event.preventDefault();const form=event.currentTarget;const button=form.querySelector("button");button.disabled=true;try{const payload=Object.fromEntries(new FormData(form).entries());const data=await request("/delivery-partners","POST",payload);message.textContent=`Created ${data.partner.name}'s delivery account. Share the temporary password securely.`;form.reset();await load();}catch(e){message.textContent=e.message;}finally{button.disabled=false;}});
document.getElementById("refreshPartners").onclick=load;
document.getElementById("logoutButton").onclick=logout;
load();
