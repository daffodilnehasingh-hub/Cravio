const $ = id => document.getElementById(id);
const outletNames = {
  1: "The Urban Tadka", 2: "Campus Cafe", 3: "Biryani Junction",
  4: "Techie Treats", 5: "Olive & Oregano", 6: "The Food Court"
};
const deliveryAvailable = { 1:true, 2:false, 3:true, 4:true, 5:true, 6:true };
let cart = JSON.parse(localStorage.getItem("cravio-cart") || "[]");
let fulfilment = "delivery";
let coupon = "";
let couponRate = 0;
let rewardBalance = 0;
let savedAddresses = [];

const selectedOutlet = (() => { try { return JSON.parse(localStorage.getItem("cravio-selected-outlet") || "null"); } catch { return null; } })();
const outletId = cart.length ? String(cart[0].outletId) : null;
const outletName = selectedOutlet && String(selectedOutlet.id) === outletId ? selectedOutlet.name : (outletNames[outletId] || "Selected outlet");
const canDeliver = selectedOutlet && String(selectedOutlet.id) === outletId ? !!selectedOutlet.delivery : !!deliveryAvailable[outletId];
const canPickup = selectedOutlet && String(selectedOutlet.id) === outletId ? !!selectedOutlet.pickup : true;
const toast = $("toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2300);
}
function subtotal() { return cart.reduce((sum, item) => sum + item.price * item.quantity, 0); }
function discountValue() {
  let rate = couponRate;
  if ($("studentDiscount").checked) rate = Math.max(rate, 0.15);
  return Math.round(subtotal() * rate);
}
function rewardPointsUsed() {
  const payment = document.querySelector('input[name="payment"]:checked')?.value;
  if (!$("useRewards")?.checked || payment === "razorpay") return 0;
  return Math.min(500, rewardBalance, Math.floor(Math.max(0, subtotal() - discountValue()) * 10));
}
function deliveryCharge() { return fulfilment === "delivery" ? (subtotal() >= 299 ? 0 : 25) : 0; }
function total() { return Math.max(0, subtotal() + deliveryCharge() - discountValue() - rewardPointsUsed()/10); }

function renderSummary() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  $("summaryCount").textContent = `${count} ${count === 1 ? "item" : "items"}`;
  $("summaryOutlet").textContent = outletName;
  $("summaryFulfilment").textContent = fulfilment === "delivery" ? "Home delivery" : "Self pickup";
  $("summaryItems").innerHTML = cart.map(item => `<div class="summary-item"><span>${item.name}<br><small>Qty ${item.quantity} × ₹${item.price}</small></span><span>₹${item.price * item.quantity}</span></div>`).join("");
  $("itemSubtotal").textContent = `₹${subtotal()}`;
  $("deliveryFee").textContent = fulfilment === "delivery" ? (deliveryCharge() ? `₹${deliveryCharge()}` : "FREE") : "FREE";
  $("discountAmount").textContent = `−₹${discountValue() + rewardPointsUsed()/10}`;
  if ($("rewardHint")) {
    const payment = document.querySelector('input[name="payment"]:checked')?.value;
    $("rewardHint").textContent = payment === "razorpay"
      ? "Choose cash on delivery or pay at outlet to redeem points."
      : `You will use ${rewardPointsUsed()} points (₹${(rewardPointsUsed()/10).toFixed(2)} off). 10 points = ₹1.`;
  }
  $("grandTotal").textContent = `₹${total()}`;
  $("placeOrder").disabled = !cart.length;
  $("placeOrder").style.opacity = cart.length ? "1" : ".55";
}
function setFulfilment(type) {
  fulfilment = type;
  document.querySelectorAll(".fulfilment-option").forEach(button => button.classList.toggle("active", button.dataset.type === type));
  const pickup = type === "pickup";
  if (pickup && !canPickup) { showToast("This outlet does not support self pickup."); return; }
  if (!pickup && !canDeliver) { showToast("This outlet does not support delivery. Select pickup."); return; }
  $("addressCard").hidden = pickup;
  $("pickupNote").hidden = !pickup;
  $("deliveryUnavailable").hidden = !(type === "delivery" && !canDeliver);
  $("summaryFulfilment").textContent = pickup ? "Self pickup" : "Home delivery";
  renderSummary();
}
async function applyCoupon() {
  const code=$("couponInput").value.trim().toUpperCase(), message=$("couponMessage");
  if(!code){coupon="";couponRate=0;renderSummary();return;}
  const token=localStorage.getItem("cravio-token");
  const outletType=["2","4","6"].includes(String(outletId))?"canteen":"restaurant";
  try{
    const response=await fetch("http://localhost:5000/api/coupons/validate",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token||""}`},body:JSON.stringify({code,subtotal:subtotal(),outletType})});
    const data=await response.json();if(!response.ok)throw new Error(data.message||"Coupon could not be applied.");
    coupon=data.code;couponRate=data.discountType==="percentage"?data.discountValue/100:(subtotal()?data.discount/subtotal():0);
    message.textContent=`${data.description||"Coupon applied!"} You save ₹${Math.round(data.discount)}.`;
    message.className="coupon-message success";
  }catch(error){coupon="";couponRate=0;message.textContent=error.message;message.className="coupon-message error";}
  renderSummary();
}
async function loadSavedAddresses() {
  const token = localStorage.getItem("cravio-token");
  if (!token) return;
  try {
    const response = await fetch("http://localhost:5000/api/addresses", { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const data = await response.json(); savedAddresses = data.addresses || [];
    const select = $("savedAddressSelect");
    select.innerHTML = '<option value="">Enter a new address</option>' + savedAddresses.map(a => `<option value="${a._id}">${a.label}${a.isDefault ? " (Default)" : ""} · ${a.house}, ${a.area}</option>`).join("");
    const preferred = savedAddresses.find(a => a.isDefault);
    if (preferred) { select.value = preferred._id; fillSavedAddress(preferred); }
  } catch (_) { /* Address book remains optional when offline. */ }
}
function fillSavedAddress(address) {
  if (!address) return;
  $("customerName").value = address.fullName || ""; $("customerPhone").value = address.phone || "";
  $("pincode").value = address.pincode || ""; $("addressLine").value = address.house || ""; $("landmark").value = address.area || "";
}
async function saveCurrentAddress() {
  if (!$("saveAddress")?.checked || fulfilment !== "delivery") return;
  const token = localStorage.getItem("cravio-token");
  const body = { label: "Home", fullName: $("customerName").value.trim(), phone: $("customerPhone").value.trim(), pincode: $("pincode").value.trim(), house: $("addressLine").value.trim(), area: $("landmark").value.trim() };
  try {
    const response = await fetch("http://localhost:5000/api/addresses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not save address.");
    showToast("Order placed! Address saved for next time.");
  } catch (error) { showToast(`Order placed, but address was not saved: ${error.message}`); }
}
function validateDelivery() {
  const fields = [
    ["customerName", "Enter your full name."],
    ["customerPhone", "Enter a valid 10-digit phone number.", /^\d{10}$/],
    ["pincode", "Enter a valid 6-digit PIN code.", /^\d{6}$/],
    ["addressLine", "Enter your house, hostel or building."],
    ["landmark", "Enter your area or a nearby landmark."]
  ];
  for (const [id, message, pattern] of fields) {
    const value = $(id).value.trim();
    if (!value || (pattern && !pattern.test(value))) {
      $(id).focus();
      showToast(message);
      return false;
    }
  }
  return true;
}
async function placeOrder() {
  if (!cart.length) { showToast("Your cart is empty. Add food before checkout."); return; }
  if (fulfilment === "delivery" && !canDeliver) {
    showToast("This outlet only supports self pickup. Select pickup to continue."); return;
  }
  if (fulfilment === "delivery" && !validateDelivery()) return;
  const token = localStorage.getItem("cravio-token");
  if (!token) { showToast("Please log in before placing an order."); window.location.href = "login.html"; return; }

  const selectedPayment = document.querySelector('input[name="payment"]:checked').value;
  const paymentMethod = selectedPayment === "pickup" ? "outlet" : selectedPayment;
  const payload = {
    outletId: String(outletId),
    items: cart.map(item => ({ itemId: String(item.id), quantity: Number(item.quantity) })),
    fulfillmentType: fulfilment, paymentMethod, couponCode: coupon,
    studentDiscountApplied: $("studentDiscount").checked,
    redeemRewardPoints: rewardPointsUsed()
  };
  if (fulfilment === "delivery") payload.deliveryAddress = {
    fullName: $("customerName").value.trim(), phone: $("customerPhone").value.trim(),
    pincode: $("pincode").value.trim(), house: $("addressLine").value.trim(), area: $("landmark").value.trim()
  };

  const button = $("placeOrder"), originalHTML = button.innerHTML;
  button.disabled = true; button.textContent = paymentMethod === "razorpay" ? "Preparing secure payment..." : "Placing order...";
  try {
    const response = await fetch("http://localhost:5000/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (response.status === 401) {
      localStorage.removeItem("cravio-token"); localStorage.removeItem("cravio-user");
      window.location.href = "login.html"; return;
    }
    if (!response.ok) throw new Error(data.message || "Unable to place your order.");

    if (paymentMethod === "razorpay") {
      if (!window.Razorpay || !data.payment) throw new Error("Razorpay Checkout could not load. Please refresh and try again.");
      button.textContent = "Waiting for payment...";
      const options = {
        key: data.payment.keyId, amount: data.payment.amount, currency: data.payment.currency,
        name: data.payment.name, description: data.payment.description,
        order_id: data.payment.razorpayOrderId,
        prefill: {
          name: data.payment.prefill?.name || (fulfilment === "delivery" ? $("customerName").value.trim() : ""),
          email: data.payment.prefill?.email || "",
          contact: fulfilment === "delivery" ? $("customerPhone").value.trim() : ""
        },
        theme: { color: "#ef6b35" },
        handler: async function (paymentResult) {
          try {
            const verifyResponse = await fetch("http://localhost:5000/api/orders/payment/verify", {
              method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ orderId: data.order._id, ...paymentResult })
            });
            const verified = await verifyResponse.json();
            if (!verifyResponse.ok) throw new Error(verified.message || "Payment verification failed.");
            await saveCurrentAddress();
            finishOrder(verified.order || data.order);
          } catch (error) {
            showToast(error.message || "Payment verification could not be completed. Check My Orders before trying again.");
            button.disabled = false; button.innerHTML = originalHTML;
          }
        },
        modal: { ondismiss: function () {
          fetch("http://localhost:5000/api/orders/payment/fail", {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ orderId: data.order._id })
          }).catch(() => {});
          showToast("Checkout closed. Cravio is checking the payment status; check My Orders before placing another order.");
          button.disabled = false; button.innerHTML = originalHTML;
        } }
      };
      const checkout = new Razorpay(options);
      checkout.on("payment.failed", function (event) {
        fetch("http://localhost:5000/api/orders/payment/fail", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ orderId: data.order._id })
        }).catch(() => {});
        showToast((event.error && event.error.description) || "Payment failed. Check My Orders before retrying.");
        button.disabled = false; button.innerHTML = originalHTML;
      });
      checkout.open();
      return;
    }
    await saveCurrentAddress();
    finishOrder(data.order);
  } catch (error) {
    showToast(error.message || "Could not connect to the Cravio server.");
    button.disabled = false; button.innerHTML = originalHTML;
  }
}
function finishOrder(order) {
  localStorage.setItem("cravio-last-order", JSON.stringify(order));
  localStorage.removeItem("cravio-cart");
  window.location.href = `orders.html?placed=${encodeURIComponent(order.orderNumber || order._id)}`;
}

$("fulfilmentOptions").addEventListener("click", event => {
  const button = event.target.closest("[data-type]");
  if (button) setFulfilment(button.dataset.type);
});
$("applyCoupon").addEventListener("click", applyCoupon);
$("couponInput").addEventListener("keydown", event => { if (event.key === "Enter") applyCoupon(); });
$("studentDiscount").addEventListener("change", renderSummary);
$("useRewards").addEventListener("change", renderSummary);
document.querySelectorAll('input[name="payment"]').forEach(input => input.addEventListener("change", renderSummary));
$("placeOrder").addEventListener("click", placeOrder);
$("savedAddressSelect")?.addEventListener("change", event => { const address = savedAddresses.find(a => String(a._id) === event.target.value); if (address) fillSavedAddress(address); });
$("backHome").addEventListener("click", () => window.location.href = "index.html");
$("themeToggle").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  $("themeToggle").innerHTML = icon(next === "dark" ? "sun" : "moon", 17);
  localStorage.setItem("cravio-theme", next);
});
const savedTheme = localStorage.getItem("cravio-theme") || "light";
document.documentElement.dataset.theme = savedTheme;
$("themeToggle").innerHTML = icon(savedTheme === "dark" ? "sun" : "moon", 17);
$("year").textContent = new Date().getFullYear();
$("backToMenu").href = outletId ? `menu.html?id=${outletId}` : "restaurants.html";

if (!cart.length) {
  $("summaryItems").innerHTML = `<div class="summary-empty">${icon("bag", 20)}<p>Your cart is empty. Go back and add some dishes.</p></div>`;
  $("placeOrder").disabled = true;
  $("placeOrder").style.opacity = ".55";
  $("summaryOutlet").textContent = "No outlet selected";
}
if (outletId) {
  // B9: show delivery-unavailable warning only when outlet truly offers no delivery
  if (!canDeliver) {
    $("deliveryUnavailable").hidden = false;
  } else {
    $("deliveryUnavailable").hidden = true;
  }
  if (canDeliver) {
    setFulfilment("delivery");
  } else if (canPickup) {
    setFulfilment("pickup");
  } else {
    $("deliveryUnavailable").hidden = false;
    $("placeOrder").disabled = true;
    showToast("This outlet currently has no fulfilment option available.");
  }
} else {
  $("deliveryUnavailable").hidden = true;
  $("placeOrder").disabled = true;
  showToast("No outlet selected");
}
// B9: step badge reflects the 4 checkout steps (fulfilment → address → offers → payment)
$("step-pill").textContent = "STEP 4 OF 4";
renderSummary();


loadSavedAddresses();
