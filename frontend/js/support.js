const API="http://localhost:5000/api", token=localStorage.getItem("cravio-token");
const form=document.getElementById("ticketForm"), list=document.getElementById("ticketList"), msg=document.getElementById("supportMessage");
if(!token) location.replace("login.html");
const headers={Authorization:`Bearer ${token}`};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function load(){
 try{
  const [t,o]=await Promise.all([fetch(`${API}/support/my`,{headers}),fetch(`${API}/orders/my`,{headers})]);
  const td=await t.json(), od=await o.json(); if(!t.ok)throw Error(td.message);
  document.getElementById("orderSelect").innerHTML='<option value="">No specific order</option>'+(od.orders||[]).map(x=>`<option value="${esc(x._id)}">${esc(x.orderNumber||x._id)} — ${esc(x.status)}</option>`).join("");
  list.innerHTML=(td.tickets||[]).length?(td.tickets||[]).map(ticket=>`<article class="ticket-card card"><div class="ticket-head"><h3>${esc(ticket.subject)}</h3><span class="badge ${["resolved","closed"].includes(ticket.status)?"badge-green":"badge-orange"}">${esc(ticket.status)}</span></div><div class="ticket-meta">${icon("ticket",12)} ${esc(ticket.ticketNumber)} · ${esc(ticket.category)}${ticket.order?` · ${icon("bag",12)} ${esc(ticket.order.orderNumber||ticket.order._id)}`:""}</div>${ticket.messages.map(m=>`<div class="ticket-message ${m.senderRole==="admin"?"admin":""}"><strong>${m.senderRole==="admin"?`${icon("shield-check",12)} Cravio support`:"You"}</strong><br>${esc(m.message)}<div class="ticket-meta">${icon("clock",12)} ${new Date(m.createdAt).toLocaleString("en-IN")}</div></div>`).join("")}${!["resolved","closed"].includes(ticket.status)?`<form class="ticket-reply" data-id="${esc(ticket._id)}"><textarea name="message" required maxlength="2000" placeholder="Add a reply..."></textarea><button class="btn btn-sm">${icon("mail",13)} Send reply</button></form>`:""}</article>`).join(""):'<div class="support-empty empty-state"><span class="empty-state-icon"><span data-icon="mail" data-size="28"></span></span><strong>No support requests yet</strong><p>You have not contacted support yet. Send us a message above and we will follow up.</p></div>';
 list.querySelectorAll(".ticket-reply").forEach(f=>f.addEventListener("submit",reply));
 }catch(e){list.textContent=e.message||"Unable to load support requests."}
}
async function reply(e){e.preventDefault();const f=e.currentTarget;try{const r=await fetch(`${API}/support/${f.dataset.id}/reply`,{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({message:f.message.value})});const d=await r.json();if(!r.ok)throw Error(d.message);msg.textContent="Reply sent.";load()}catch(x){msg.textContent=x.message}}
form.addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(form);try{const r=await fetch(`${API}/support`,{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(fd))});const d=await r.json();if(!r.ok)throw Error(d.message);msg.textContent=`Request submitted: ${d.ticket.ticketNumber}`;form.reset();load()}catch(x){msg.textContent=x.message}});
load();
