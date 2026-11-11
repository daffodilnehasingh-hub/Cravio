let outlets = [
  { id: 1, name: "The Urban Tadka", type: "restaurant", rating: 4.7, reviews: 328, price: 250, time: "25–30 min", distance: "1.8 km", delivery: true, pickup: true, offer: "20% OFF", cuisine: "North Indian · Chinese", description: "Comforting North Indian favourites and quick bites.", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=85" },
  { id: 2, name: "Campus Cafe", type: "canteen", rating: 4.5, reviews: 146, price: 80, time: "10–15 min", distance: "On campus", delivery: false, pickup: true, offer: "STUDENT DEAL", cuisine: "Snacks · Beverages", description: "A campus favourite for quick breaks between classes.", image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=900&q=85" },
  { id: 3, name: "Biryani Junction", type: "restaurant", rating: 4.6, reviews: 512, price: 180, time: "30–35 min", distance: "2.4 km", delivery: true, pickup: true, offer: "FREE DELIVERY", cuisine: "Biryani · Mughlai", description: "Aromatic biryani, rich gravies and classic sides.", image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=900&q=85" },
  { id: 4, name: "Techie Treats", type: "canteen", rating: 4.3, reviews: 89, price: 60, time: "8–12 min", distance: "On campus", delivery: true, pickup: true, offer: "FROM ₹49", cuisine: "Sandwiches · Drinks", description: "Budget-friendly bites served fresh on campus.", image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=85" },
  { id: 5, name: "Olive & Oregano", type: "restaurant", rating: 4.8, reviews: 204, price: 300, time: "25–35 min", distance: "3.1 km", delivery: true, pickup: true, offer: "COMBO DEALS", cuisine: "Pizza · Italian", description: "Wood-fired style pizzas, pasta and fresh salads.", image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=85" },
  { id: 6, name: "The Food Court", type: "canteen", rating: 4.4, reviews: 173, price: 100, time: "12–18 min", distance: "On campus", delivery: true, pickup: true, offer: "CAMPUS COMBO", cuisine: "Thalis · South Indian", description: "Everyday meals and snacks for the campus crowd.", image: "https://images.unsplash.com/photo-1564758866811-478b6f3f2f2b?auto=format&fit=crop&w=900&q=85" }
];

const params = new URLSearchParams(window.location.search);
const API="http://localhost:5000/api";
const token=localStorage.getItem("cravio-token");
const state = { type: params.get("type") || "all", query: (params.get("q")||"").trim().toLowerCase(), cuisine:"all", favorites:new Set(), summaries:{} };
async function loadUserOutletData(){
  try{
    const outletResponse=await fetch(`${API}/outlets`);
    if(outletResponse.ok){
      const outletData=await outletResponse.json();
      if(outletData.outlets?.length) outlets=outletData.outlets.map(o=>({id:String(o.outletId),name:o.name,type:o.type,rating:0,reviews:0,price:(()=>{const prices=(o.items||[]).filter(i=>i.available!==false).map(i=>Number(i.price)).filter(Number.isFinite);return prices.length?Math.min(...prices):999999})(),time:"20–30 min",distance:"Kota",delivery:o.delivery,pickup:o.pickup,offer:"",cuisine:o.cuisine||"",description:o.description||"",image:o.image||"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=85"}));
    }
    const summaryResponse=await fetch(`${API}/reviews/summary`);
    if(summaryResponse.ok){const data=await summaryResponse.json();state.summaries=Object.fromEntries((data.summaries||[]).map(x=>[x._id,x]));}
    if(token){const response=await fetch(`${API}/favorites`,{headers:{Authorization:`Bearer ${token}`}});if(response.ok){const data=await response.json();state.favorites=new Set((data.favorites||[]).map(x=>String(x.outletId)));}}
  }catch(e){console.warn("Outlet ratings/favorites are temporarily unavailable.");}
  populateCuisineFilter();
  document.getElementById("outletSearch").value=state.query;
  renderOutlets();
}
const grid = document.getElementById("outletGrid");
const empty = document.getElementById("noOutlets");
const toast = document.getElementById("toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function escapeHTML(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function populateCuisineFilter(){
  const select=document.getElementById("cuisineFilter");
  const cuisines=[...new Set(outlets.flatMap(o=>String(o.cuisine||"").split(/[·,]/).map(x=>x.trim()).filter(Boolean)))].sort();
  select.innerHTML='<option value="all">All cuisines</option>'+cuisines.map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
  select.value=state.cuisine;
}
function renderOutlets() {
  const delivery = document.getElementById("hasDelivery").checked;
  const pickup = document.getElementById("hasPickup").checked;
  const budget = document.getElementById("budgetOnly").checked;
  const minRating = Number(document.getElementById("minOutletRating").value);
  const sort = document.getElementById("outletSort").value;
  const maxPrice=Number(document.getElementById("maxOutletPrice").value);
  let results = outlets.filter(outlet => {
    const text = `${outlet.name} ${outlet.cuisine} ${outlet.description} ${outlet.type}`.toLowerCase();
    const rating=Number(state.summaries[outlet.id]?.averageRating||outlet.rating||0);
    const cuisineMatches=state.cuisine==="all"||String(outlet.cuisine||"").toLowerCase().includes(state.cuisine.toLowerCase());
    return (state.type === "all" || outlet.type === state.type) && text.includes(state.query) && cuisineMatches &&
      (!delivery || outlet.delivery) && (!pickup || outlet.pickup) &&
      (!budget || outlet.price <= 150) && outlet.price<=maxPrice && rating >= minRating;
  });
  if (sort === "rating") results.sort((a, b) => Number(state.summaries[b.id]?.averageRating||b.rating||0) - Number(state.summaries[a.id]?.averageRating||a.rating||0));
  if (sort === "price") results.sort((a, b) => a.price - b.price);
  if (sort === "name") results.sort((a,b)=>a.name.localeCompare(b.name));

  document.getElementById("resultsTitle").textContent = state.type === "restaurant" ? "Restaurants near you" : state.type === "canteen" ? "College canteens" : "All places near you";
  document.getElementById("resultsCount").textContent = `Showing ${results.length} ${results.length === 1 ? "outlet" : "outlets"}`;
  grid.innerHTML = results.map(outlet => `
    <article class="outlet-card">
      <div class="outlet-image-wrap">
        <img class="outlet-image" src="${outlet.image}" alt="${outlet.name}" loading="lazy">
        <span class="outlet-type">${outlet.type === "canteen" ? icon("graduation-cap", 12) + " COLLEGE CANTEEN" : icon("utensils", 12) + " RESTAURANT"}</span>
        <span class="outlet-offer">${outlet.offer}</span>
        <button class="outlet-favorite ${state.favorites.has(String(outlet.id))?"saved":""}" data-favorite="${outlet.id}" aria-label="Toggle favorite">${icon("heart", 16)}</button>
      </div>
      <div class="outlet-info">
        <div class="outlet-title-line"><h3>${outlet.name}</h3><span class="outlet-rating">${outlet.rating&&outlet.rating>0? icon("star", 12) + " " + (state.summaries[outlet.id]?.averageRating||outlet.rating||0).toFixed(1) : "New"} <span>(${state.summaries[outlet.id]?.reviewCount||0} reviews)</span></span></div>
        <p class="outlet-description">${outlet.cuisine} · ${outlet.description}</p>
        <div class="outlet-meta"><span>${icon("clock", 12)} ${outlet.time}</span><span>${icon("map-pin", 12)} ${outlet.distance}</span><span class="${outlet.delivery ? "meta-ok" : "meta-no"}">${outlet.delivery ? icon("check", 12) + " Delivery" : icon("minus", 12) + " No delivery"}</span><span class="${outlet.pickup ? "meta-ok" : "meta-no"}">${outlet.pickup ? icon("check", 12) + " Pickup" : icon("minus", 12) + " No pickup"}</span></div>
        <div class="outlet-footer"><span class="outlet-price">₹${outlet.price} <small>Approx. starting price</small></span><button class="menu-link" data-outlet="${outlet.id}">Explore menu ${icon("arrow-right", 13)}</button></div>
      </div>
    </article>`).join("");
  empty.hidden = results.length > 0;
  grid.hidden = results.length === 0;
}

function setType(type) {
  state.type = type;
  document.querySelectorAll(".outlet-tab").forEach(tab => {
    const active = tab.dataset.type === type;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  renderOutlets();
}

document.querySelector(".outlet-tabs").addEventListener("click", event => {
  const tab = event.target.closest("[data-type]");
  if (tab) setType(tab.dataset.type);
});
document.getElementById("outletSearch").addEventListener("input", event => {
  state.query = event.target.value.trim().toLowerCase();
  renderOutlets();
});
document.getElementById("listingFilterToggle").addEventListener("click", () => {
  const panel = document.getElementById("listingFilterPanel");
  panel.hidden = !panel.hidden;
  document.getElementById("listingFilterToggle").setAttribute("aria-expanded", String(!panel.hidden));
});
["hasDelivery", "hasPickup", "budgetOnly", "minOutletRating", "outletSort", "maxOutletPrice"].forEach(id => document.getElementById(id).addEventListener("change", renderOutlets));
document.getElementById("cuisineFilter").addEventListener("change",event=>{state.cuisine=event.target.value;renderOutlets();});
grid.addEventListener("click", async event => {
  const favoriteButton=event.target.closest("[data-favorite]");
  if(favoriteButton){
    if(!token){showToast("Log in to save favorite outlets.");return;}
    const id=String(favoriteButton.dataset.favorite),saved=state.favorites.has(id);
    try{const response=await fetch(`${API}/favorites/${id}`,{method:saved?"DELETE":"POST",headers:{Authorization:`Bearer ${token}`}});
      const data=await response.json();if(!response.ok)throw Error(data.message||"Could not update favorites.");
      if(saved)state.favorites.delete(id);else state.favorites.add(id);
      showToast(data.message);renderOutlets();
    }catch(error){showToast(error.message);}
    return;
  }
  const button = event.target.closest("[data-outlet]");
  if (!button) return;
  const outlet = outlets.find(item => String(item.id) === String(button.dataset.outlet));
  window.location.href = `menu.html?id=${outlet.id}`;
});
document.getElementById("resetListing").addEventListener("click", () => {
  state.query = "";
  document.getElementById("outletSearch").value = "";
  ["hasDelivery", "hasPickup", "budgetOnly"].forEach(id => document.getElementById(id).checked = false);
  document.getElementById("minOutletRating").value = "0";
  document.getElementById("maxOutletPrice").value = "999999";
  document.getElementById("cuisineFilter").value = "all";
  state.cuisine="all";
  document.getElementById("outletSort").value = "recommended";
  setType("all");
});
document.getElementById("themeToggle").addEventListener("click", () => {
  const root = document.documentElement;
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  document.getElementById("themeToggle").innerHTML = icon(next === "dark" ? "sun" : "moon", 18);
  localStorage.setItem("cravio-theme", next);
});
const savedTheme = localStorage.getItem("cravio-theme") || "light";
document.documentElement.dataset.theme = savedTheme;
document.getElementById("themeToggle").innerHTML = icon(savedTheme === "dark" ? "sun" : "moon", 18);
document.getElementById("year").textContent = new Date().getFullYear();
setType(["all", "restaurant", "canteen"].includes(state.type) ? state.type : "all");
loadUserOutletData();
