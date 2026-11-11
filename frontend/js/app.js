const products = [
  { id: 1, name: "Classic Veg Burger", source: "Burger Barn · Restaurant", category: "Snacks", type: "veg", price: 99, rating: 4.6, time: "20–25 min", delivery: true, pickup: true, badge: "BESTSELLER", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80" },
  { id: 2, name: "Paneer Tikka Pizza", source: "Oven Story · Restaurant", category: "Veg", type: "veg", price: 189, rating: 4.7, time: "25–30 min", delivery: true, pickup: true, badge: "POPULAR", image: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=800&q=80" },
  { id: 3, name: "Chicken Dum Biryani", source: "Hyderabadi House · Restaurant", category: "Non-Veg", type: "nonveg", price: 179, rating: 4.5, time: "30–35 min", delivery: true, pickup: true, badge: "CHEF'S PICK", image: "https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=800&q=80" },
  { id: 4, name: "Masala Dosa", source: "Campus Cafe · College canteen", category: "Veg", type: "veg", price: 70, rating: 4.4, time: "10–15 min", delivery: false, pickup: true, badge: "CAMPUS FAVOURITE", image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" },
  { id: 5, name: "Fresh Green Bowl", source: "Green Theory · Restaurant", category: "Vegan", type: "veg", price: 149, rating: 4.3, time: "15–20 min", delivery: true, pickup: true, badge: "FRESH & LIGHT", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80" },
  { id: 6, name: "Cold Coffee", source: "The Coffee Stop · College canteen", category: "Drinks", type: "veg", price: 65, rating: 4.8, time: "8–12 min", delivery: true, pickup: true, badge: "STUDENT FAVOURITE", image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=80" },
  { id: 7, name: "Street Style Momos", source: "Momo Junction · Restaurant", category: "Street Food", type: "veg", price: 89, rating: 4.5, time: "15–20 min", delivery: true, pickup: true, badge: "LOCAL FAVOURITE", image: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80" },
  { id: 8, name: "Paneer Kathi Roll", source: "Rolls & Bowls · Restaurant", category: "Street Food", type: "veg", price: 119, rating: 4.2, time: "20–25 min", delivery: true, pickup: true, badge: "QUICK BITE", image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=800&q=80" },
  { id: 9, name: "Peri Peri Fries", source: "Campus Cafe · College canteen", category: "Snacks", type: "veg", price: 79, rating: 4.1, time: "10–15 min", delivery: false, pickup: true, badge: "UNDER ₹100", image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80" }
];
const API="http://localhost:5000/api";
const token=localStorage.getItem("cravio-token");
const state={category:"All",query:"",favorites:new Set(JSON.parse(localStorage.getItem("cravio-home-favorites")||"[]")),products:[]};
const foodGrid=document.getElementById("foodGrid"),emptyState=document.getElementById("emptyState"),toast=document.getElementById("toast");
function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove("show"),2300);}
function safe(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function toHomeProduct(item){
 const outletType=item.outletType||"restaurant";
 return {id:String(item.id),outletId:String(item.outletId??""),name:item.name,source:`${item.outletName||item.source||"Cravio outlet"} · ${outletType==="canteen"?"College canteen":"Restaurant"}`,category:item.category||"Other",type:item.isVeg===false?"nonveg":"veg",price:Number(item.price||0),rating:Number(item.rating||0),time:"20–30 min",delivery:true,pickup:true,badge:item.reason||"FRESH PICK",image:item.image||"https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"};
}
async function loadRecommendations(){
 try{
  let data=null;
  if(token){
   const personal=await fetch(`${API}/outlets/recommendations/me`,{headers:{Authorization:`Bearer ${token}`}});
   if(personal.ok)data=await personal.json();
  }
  if(!data?.recommendations?.length){
   const response=await fetch(`${API}/outlets/recommendations`);
   if(response.ok)data=await response.json();
  }
  if(data?.recommendations?.length){
   state.products=data.recommendations.map(toHomeProduct);
   const personalized=data.mode==="personalized";
   document.querySelector("#restaurants .eyebrow").textContent=personalized?"PICKED FROM YOUR ORDER HISTORY":"POPULAR ON CRAVIO";
   document.querySelector("#restaurants h2").textContent=personalized?"Recommended for you":"Popular near you";
   document.querySelector("#restaurants .section-subtitle").textContent=personalized?"Dishes inspired by what you have ordered before.":"Dishes customers are ordering from participating outlets.";
  }else state.products=products;
 }catch(error){console.warn("Using homepage demo recommendations:",error.message);state.products=products;}
 renderProducts();
}
function renderProducts(){
 const vegOnly=document.getElementById("vegOnly").checked,pickupOnly=document.getElementById("pickupOnly").checked,deliveryOnly=document.getElementById("deliveryOnly").checked,minRating=Number(document.getElementById("ratingFilter").value),sort=document.getElementById("sortSelect").value;
 let visible=state.products.filter(item=>{
  const searchable=`${item.name} ${item.source} ${item.category}`.toLowerCase();
  const categoryMatch=state.category==="All"||(state.category==="Veg"&&item.type==="veg")||(state.category==="Non-Veg"&&item.type==="nonveg")||item.category.toLowerCase()===state.category.toLowerCase();
  return categoryMatch&&searchable.includes(state.query.toLowerCase())&&(!vegOnly||item.type==="veg")&&(!pickupOnly||item.pickup)&&(!deliveryOnly||item.delivery)&&item.rating>=minRating;
 });
 if(sort==="rating")visible.sort((a,b)=>b.rating-a.rating);
 if(sort==="price")visible.sort((a,b)=>a.price-b.price);
 foodGrid.innerHTML=visible.map(item=>`
 <article class="food-card"><div class="food-image-wrap"><img class="food-image" src="${safe(item.image)}" alt="${safe(item.name)}" loading="lazy"><span class="food-badge">${safe(item.badge)}</span><button class="favorite-button ${state.favorites.has(item.id)?"is-favorite":""}" data-favorite="${safe(item.id)}" aria-label="Toggle ${safe(item.name)} favorite">${icon("heart",16)}</button></div>
 <div class="food-info"><div class="food-title-row"><h3>${safe(item.name)}</h3><span class="rating">${item.rating?`${icon("star",12)} ${item.rating.toFixed(1)}`:"NEW"}</span></div><p class="food-source">${safe(item.source)}</p><div class="food-meta"><span class="food-price">₹${item.price} <small>· ${safe(item.time)}</small></span><div class="home-food-actions">${item.outletId?`<button class="add-button" data-view="${safe(item.outletId)}">View menu</button><button class="add-button" data-add="${safe(item.id)}" data-outlet="${safe(item.outletId)}">+ Add</button>`:`<button class="add-button" data-browse>Explore outlets</button>`}</div></div></div></article>`).join("");
 emptyState.hidden=visible.length>0;
}
document.getElementById("categoryGrid").addEventListener("click",event=>{const button=event.target.closest("[data-category]");if(!button)return;state.category=button.dataset.category;document.querySelectorAll(".category-card").forEach(card=>card.classList.toggle("selected",card===button));renderProducts();});
document.getElementById("clearCategory").addEventListener("click",()=>{state.category="All";document.querySelectorAll(".category-card").forEach(card=>card.classList.toggle("selected",card.dataset.category==="All"));renderProducts();});
document.getElementById("searchForm").addEventListener("submit",event=>{event.preventDefault();state.query=document.getElementById("searchInput").value.trim();renderProducts();document.getElementById("restaurants").scrollIntoView({behavior:"smooth"});if(!state.products.some(x=>`${x.name} ${x.source}`.toLowerCase().includes(state.query.toLowerCase()))&&state.query)window.location.href=`restaurants.html?q=${encodeURIComponent(state.query)}`;});
document.getElementById("searchInput").addEventListener("input",event=>{state.query=event.target.value.trim();renderProducts();});
document.getElementById("filterToggle").addEventListener("click",()=>{const panel=document.getElementById("filterPanel");panel.hidden=!panel.hidden;document.getElementById("filterToggle").setAttribute("aria-expanded",String(!panel.hidden));});
["vegOnly","pickupOnly","deliveryOnly","ratingFilter","sortSelect"].forEach(id=>document.getElementById(id).addEventListener("change",renderProducts));
foodGrid.addEventListener("click",event=>{
 const favorite=event.target.closest("[data-favorite]"),add=event.target.closest("[data-add]"),view=event.target.closest("[data-view]"),browse=event.target.closest("[data-browse]");
 if(browse){location.href="restaurants.html";return;}
 if(favorite){const id=String(favorite.dataset.favorite);state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);localStorage.setItem("cravio-home-favorites",JSON.stringify([...state.favorites]));renderProducts();showToast(state.favorites.has(id)?"Added to your favourites ♥":"Removed from favourites");return;}
 if(view){location.href=`menu.html?id=${encodeURIComponent(view.dataset.view)}`;return;}
 if(add){const item=state.products.find(x=>String(x.id)===String(add.dataset.add));if(!item)return;const cart=JSON.parse(localStorage.getItem("cravio-cart")||"[]");if(cart.length&&cart.some(x=>String(x.outletId)!==String(item.outletId))){showToast("Your cart has items from another outlet. Clear it before ordering here.");return;}let line=cart.find(x=>String(x.id)===String(item.id)&&String(x.outletId)===String(item.outletId));if(line)line.quantity+=1;else cart.push({id:String(item.id),outletId:String(item.outletId),name:item.name,price:item.price,quantity:1});localStorage.setItem("cravio-cart",JSON.stringify(cart));localStorage.setItem("cravio-selected-outlet",JSON.stringify({id:String(item.outletId),name:item.source.split(" · ")[0],type:item.source.includes("College canteen")?"canteen":"restaurant",delivery:true,pickup:true}));showToast(`${item.name} added to your cart`);}
});
document.getElementById("themeToggle").addEventListener("click",()=>{const root=document.documentElement,nextTheme=root.dataset.theme==="dark"?"light":"dark";root.dataset.theme=nextTheme;document.getElementById("themeToggle").innerHTML=cravioIcon(nextTheme==="dark"?"sun":"moon",19);localStorage.setItem("cravio-theme",nextTheme);});
const savedTheme=localStorage.getItem("cravio-theme")||"light";document.documentElement.dataset.theme=savedTheme;document.getElementById("themeToggle").innerHTML=cravioIcon(savedTheme==="dark"?"sun":"moon",19);document.getElementById("year").textContent=new Date().getFullYear();
loadRecommendations();
