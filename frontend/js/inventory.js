const API = "http://localhost:5000/api";
const token = localStorage.getItem("cravio-token");
const list = document.getElementById("inventoryList");
const message = document.getElementById("inventoryMessage");
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function logout(){localStorage.removeItem("cravio-token");localStorage.removeItem("cravio-user");location.replace("login.html");}
async function request(url,method="GET",body){const response=await fetch(API+url,{method,headers:{Authorization:`Bearer ${token}`,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw Error(data.message||"Request failed.");return data;}
async function loadInventory(){
  message.textContent="";list.innerHTML="<p>Loading inventory...</p>";
  try{
    if(!token){logout();return;}
    const me=await request("/auth/me");
    if(!["admin","vendor"].includes(me.user.role)){list.innerHTML='<div class="empty-inventory">Inventory management is available to admins and vendors only.</div>';return;}
    const data=await request("/outlets/manage/inventory");
    const items=data.items||[];
    const low=items.filter(i=>i.stockQuantity<=i.lowStockThreshold).length;
    const out=items.filter(i=>i.stockQuantity===0).length;
    document.getElementById("inventorySummary").innerHTML=[
      ["Menu items",items.length,"package"],["Low stock",low,"alert"],["Out of stock",out,"x"]
    ].map(([label,value,ic])=>`<div class="summary-card"><span class="stat-icon">${icon(ic,18)}</span><span>${label}</span><strong>${value}</strong></div>`).join("");
    list.innerHTML=items.length?items.map(item=>{
      const status=item.stockQuantity===0?"Out of stock":item.stockQuantity<=item.lowStockThreshold?"Low stock":"In stock";
      const cls=item.stockQuantity===0?"out":item.stockQuantity<=item.lowStockThreshold?"low":"";
      return `<article class="inventory-row">
        <div><div class="item-name">${escapeHtml(item.name)}</div><div class="item-meta">${escapeHtml(item.outletName)} · ${escapeHtml(item.category)} · ${escapeHtml(item.itemId)}</div></div>
        <div><span class="stock-badge ${cls} badge ${item.stockQuantity===0?"badge-red":item.stockQuantity<=item.lowStockThreshold?"badge-gold":"badge-green"}">${status}</span><div class="item-meta">${item.available?"Menu enabled":"Menu disabled"}</div></div>
        <form class="stock-form" data-outlet="${escapeHtml(item.outletId)}" data-item="${escapeHtml(item.itemId)}">
          <div class="stock-fields">
            <label>Quantity<input name="stockQuantity" type="number" min="0" max="100000" step="1" value="${item.stockQuantity}" required></label>
            <label>Alert at<input name="lowStockThreshold" type="number" min="0" max="100000" step="1" value="${item.lowStockThreshold}" required></label>
          </div>
        </form>
        <button type="button" class="btn btn-sm" data-save="${escapeHtml(item.outletId)}" data-item="${escapeHtml(item.itemId)}">Save stock</button>
      </article>`;
    }).join(""):'<div class="empty-inventory"><span class="empty-state-icon"><span data-icon="package" data-size="26"></span></span>No menu items found. Add items from outlet management first.</div>';
    list.querySelectorAll("[data-save]").forEach(button=>button.addEventListener("click",saveStock));
  }catch(error){list.innerHTML=`<div class="empty-inventory">${escapeHtml(error.message)}</div>`;}
}
async function saveStock(event){
  const button=event.currentTarget;
  const form=button.closest(".inventory-row").querySelector(".stock-form");
  const values=Object.fromEntries(new FormData(form).entries());
  button.disabled=true;button.textContent="Saving...";
  try{
    const data=await request(`/outlets/${encodeURIComponent(button.dataset.save)}/items/${encodeURIComponent(button.dataset.item)}/stock`,"PATCH",{
      stockQuantity:Number(values.stockQuantity),lowStockThreshold:Number(values.lowStockThreshold)
    });
    message.textContent=`${data.item.name} inventory updated.`;
    await loadInventory();
  }catch(error){message.textContent=error.message;}
  finally{button.disabled=false;button.textContent="Save stock";}
}
document.getElementById("refreshInventory").addEventListener("click",loadInventory);
loadInventory();
