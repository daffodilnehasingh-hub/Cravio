const API="http://localhost:5000/api",token=localStorage.getItem("cravio-token");
const id=new URLSearchParams(location.search).get("id");
const message=document.getElementById("receiptMessage"),content=document.getElementById("receiptContent");
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function money(v){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v)||0);}
async function load(){
 if(!token){location.replace("login.html");return;}
 if(!id){message.innerHTML='<div class="empty-state"><span class="empty-state-icon"><span data-icon="receipt" data-size="28"></span></span><strong>Receipt ID is missing</strong><p><a href="orders.html">Back to orders</a></div>';return;}
 try{
  const response=await fetch(`${API}/orders/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`}});
  const data=await response.json();if(!response.ok)throw Error(data.message||"Unable to load receipt.");
  const o=data.order,addr=o.deliveryAddress||{};
  message.textContent=`Order ${o.orderNumber||o._id} · ${new Date(o.createdAt).toLocaleString("en-IN")}`;
  content.innerHTML=`<div class="receipt-grid"><section><h2>ORDER DETAILS</h2><div>${esc(o.outlet?.name)}</div><div class="receipt-muted">Order ID: ${esc(o._id)}</div><div class="receipt-muted">Status: ${esc(o.status?.replaceAll("_"," "))}</div><div class="receipt-muted">Fulfilment: ${esc(o.fulfillmentType)}</div></section>
  <section><h2>${o.fulfillmentType==="delivery"?"DELIVERY ADDRESS":"CUSTOMER"}</h2><div>${esc(addr.fullName||"Customer")}</div><div class="receipt-muted">${esc([addr.house,addr.area,addr.landmark,addr.pincode].filter(Boolean).join(", ")||"Self-pickup at outlet")}</div><div class="receipt-muted">${esc(addr.phone||"")}</div></section></div>
  <table class="receipt-items"><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${(o.items||[]).map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.quantity)}</td><td>${money(x.lineTotal)}</td></tr>`).join("")}</tbody></table>
  <div class="receipt-totals"><div class="receipt-total-row"><span>Subtotal</span><b>${money(o.subtotal)}</b></div><div class="receipt-total-row"><span>Discount</span><b>− ${money(o.discount)}</b></div><div class="receipt-total-row"><span>Delivery fee</span><b>${money(o.deliveryFee)}</b></div><div class="receipt-total-row receipt-grand"><span>Total</span><span>${money(o.total)}</span></div></div>
  <p class="receipt-muted">Payment method: ${esc(o.paymentMethod)} · Payment status: ${esc(o.paymentStatus)}</p>
  ${o.status==="cancelled"?`<p class="receipt-muted">Cancellation reason: ${esc(o.cancellationReason||"Not provided")}</p>`:""}
  <div class="receipt-footer">Thank you for choosing Cravio. Your cravings, our priority.</div>`;
 }catch(e){message.textContent=e.message;}
}
document.getElementById("printReceipt").addEventListener("click",()=>window.print());load();
