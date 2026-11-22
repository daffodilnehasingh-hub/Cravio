/* Shared header cart for pages that do not have the menu-page cart
   (index.html, restaurants.html) — UI fix 1.
   Reads/writes the same localStorage cart ("cravio-cart") the menu page
   uses, shows the live item count in the header button (#cartJump), and
   opens a cart modal with quantity steppers + checkout link. */
(function () {
  var KEY = "cravio-cart";
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
  }
  function write(cart) { localStorage.setItem(KEY, JSON.stringify(cart)); }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function iconFor(name, size) {
    return typeof window.icon === "function" ? window.icon(name, size) : "";
  }
  var backdrop = null;

  function count() {
    return read().reduce(function (s, x) { return s + Number(x.quantity || 0); }, 0);
  }
  function refresh() {
    var n = count();
    document.querySelectorAll("#headerCartCount").forEach(function (el) { el.textContent = n; });
  }

  function ensureModal() {
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.className = "cw-backdrop";
    backdrop.hidden = true;
    backdrop.innerHTML =
      '<section class="cw-modal" role="dialog" aria-modal="true" aria-labelledby="cwTitle">' +
        '<div class="cw-heading"><div><span class="eyebrow">YOUR CRAVINGS</span><h2 id="cwTitle">Your cart</h2></div>' +
        '<button type="button" class="cw-close" aria-label="Close cart">' + iconFor("x", 16) + "</button></div>" +
        '<p class="cw-outlet"></p>' +
        '<div class="cw-lines"></div>' +
        '<div class="cw-total"><span>Subtotal</span><strong>₹0</strong></div>' +
        '<button type="button" class="cw-checkout">Continue to checkout ' + iconFor("arrow-right", 14) + "</button>" +
      "</section>";
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
    backdrop.querySelector(".cw-close").addEventListener("click", close);
    backdrop.querySelector(".cw-checkout").addEventListener("click", function () {
      window.location.href = "checkout.html";
    });
    backdrop.querySelector(".cw-lines").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-cw-qty]");
      if (!btn) return;
      changeQty(btn.getAttribute("data-id"), btn.getAttribute("data-outlet"), Number(btn.getAttribute("data-cw-qty")));
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    return backdrop;
  }

  function render() {
    var cart = read();
    var box = ensureModal();
    var lines = box.querySelector(".cw-lines");
    var outletEl = box.querySelector(".cw-outlet");
    var selected = null;
    try { selected = JSON.parse(localStorage.getItem("cravio-selected-outlet") || "null"); } catch (e) {}
    if (cart.length && selected && String(selected.id) === String(cart[0].outletId)) {
      outletEl.textContent = "Ordering from " + selected.name;
    } else {
      outletEl.textContent = "";
    }
    if (!cart.length) {
      lines.innerHTML = '<p class="cw-empty">Your cart is empty. Add something delicious from the menu.</p>';
    } else {
      lines.innerHTML = cart.map(function (x) {
        return '<div class="cw-line"><div><strong>' + esc(x.name) + "</strong><small>₹" + esc(x.price) + " × " + esc(x.quantity) + "</small></div>" +
          '<div class="cw-actions">' +
          '<button type="button" data-cw-qty="-1" data-id="' + esc(x.id) + '" data-outlet="' + esc(x.outletId) + '" aria-label="Remove one">' + iconFor("minus", 12) + "</button>" +
          "<b>" + esc(x.quantity) + "</b>" +
          '<button type="button" data-cw-qty="1" data-id="' + esc(x.id) + '" data-outlet="' + esc(x.outletId) + '" aria-label="Add one">' + iconFor("plus", 12) + "</button>" +
          "</div></div>";
      }).join("");
    }
    var total = cart.reduce(function (s, x) { return s + Number(x.price || 0) * Number(x.quantity || 0); }, 0);
    box.querySelector(".cw-total strong").textContent = "₹" + total;
    box.querySelector(".cw-checkout").disabled = !cart.length;
    refresh();
  }

  function changeQty(id, outletId, delta) {
    var cart = read();
    var line = cart.find(function (x) { return String(x.id) === String(id) && String(x.outletId) === String(outletId); });
    if (!line) return;
    line.quantity = Number(line.quantity || 0) + delta;
    if (line.quantity <= 0) {
      cart = cart.filter(function (x) { return !(String(x.id) === String(id) && String(x.outletId) === String(outletId)); });
    }
    write(cart);
    render();
  }

  function open() { render(); ensureModal().hidden = false; }
  function close() { if (backdrop) backdrop.hidden = true; }

  document.querySelectorAll("#cartJump, [data-open-cart]").forEach(function (btn) {
    btn.addEventListener("click", open);
  });
  window.addEventListener("storage", function (e) { if (e.key === KEY) refresh(); });
  refresh();

  window.CravioCartWidget = { refresh: refresh, open: open };
})();
