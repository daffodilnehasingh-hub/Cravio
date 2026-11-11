const fs = require("fs");
const data = JSON.parse(fs.readFileSync(__dirname + "/lucide-paths.json", "utf8"));
const rename = {
  "search": "search", "sliders-horizontal": "sliders", "map-pin": "map-pin", "moon": "moon",
  "sun": "sun", "heart": "heart", "star": "star", "user": "user", "shopping-cart": "cart",
  "shopping-bag": "bag", "bell": "bell", "clock": "clock", "check": "check",
  "check-circle-2": "check-circle", "x": "x", "plus": "plus", "minus": "minus",
  "arrow-right": "arrow-right", "arrow-up-right": "arrow-up-right", "chevron-down": "chevron-down",
  "chevron-right": "chevron-right", "trash-2": "trash", "pencil": "edit", "eye": "eye", "map": "map",
  "phone": "phone", "mail": "mail", "log-out": "log-out", "log-in": "log-in", "ticket-percent": "ticket",
  "percent": "percent", "wallet": "wallet", "credit-card": "credit-card", "truck": "truck",
  "store": "store", "house": "home", "utensils": "utensils", "leaf": "leaf", "cup-soda": "cup",
  "flame": "flame", "drumstick": "drumstick", "cookie": "cookie", "sprout": "sprout",
  "graduation-cap": "graduation-cap", "school": "school", "zap": "zap", "sparkles": "sparkles",
  "gift": "gift", "package": "package", "info": "info", "circle-alert": "alert",
  "shield-check": "shield-check", "settings": "settings", "list": "list", "receipt-text": "receipt",
  "locate-fixed": "locate", "badge-percent": "badge-percent", "hand-platter": "platter"
};
const paths = {};
for (const [k, v] of Object.entries(rename)) if (data[k]) paths[v] = data[k];

const lines = Object.entries(paths).map(([n, p]) => "    " + JSON.stringify(n) + ": " + JSON.stringify(p)).join(",\n");

const js = `/* Cravio icon system — authentic Lucide (ISC) glyph data, embedded inline. No emoji, no runtime CDN.
   Usage (HTML):  <span class="ci" data-icon="search"></span>   <span data-icon="heart" data-size="18"></span>
   Usage (JS):    icon("cart")  ->  SVG string
   Migration: standalone emoji/glyph text nodes are auto-replaced on load and for dynamically added nodes. */
(function () {
  "use strict";
  const paths = {
${lines}
  };

  function svg(name, size, cls) {
    const body = paths[name] || paths.sparkles;
    const s = size || 20;
    return '<svg xmlns="http://www.w3.org/2000/svg" class="cravio-svg' + (cls ? " " + cls : "") +
      '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + "</svg>";
  }

  /* Glyph / emoji -> icon migration (exact standalone text nodes only) */
  const glyphMap = {
    "\\u263E": "moon", "\\u263D": "moon", "\\u263C": "sun", "\\u2600": "sun", "\\u26A1": "zap",
    "\\u2661": "heart", "\\u2665": "heart", "\\u2764": "heart",
    "\\u2315": "search", "\\u2316": "map-pin", "\\u2601": "sliders",
    "\\u2605": "star", "\\u2733": "sparkles", "\\u2726": "sparkles", "\\u2197": "arrow-up-right",
    "\\u2192": "arrow-right", "\\u2190": "arrow-right", "\\u2934": "arrow-up-right",
    "\\u2713": "check", "\\u2714": "check", "\\u2717": "x",
    "\\uD83D\\uDCCD": "map-pin", "\\uD83C\\uDF93": "graduation-cap", "\\uD83C\\uDFEB": "school",
    "\\uD83C\\uDF7D": "utensils", "\\uD83C\\uDF6D": "utensils", "\\uD83C\\uDF2E": "flame", "\\uD83C\\uDF5F": "drumstick",
    "\\uD83C\\uDF43": "leaf", "\\uD83C\\uDF71": "drumstick", "\\uD83C\\uDF5C": "sprout", "\\uD83C\\uDF61": "cookie",
    "\\uD83C\\uDF64": "flame", "\\uD83C\\uDF7F": "cup", "\\uD83C\\uDF7A": "cup", "\\u2615": "cup",
    "\\uD83D\\uDCD2": "package", "\\uD83D\\uDCE6": "package", "\\uD83D\\uDED2": "cart", "\\uD83D\\uDE9A": "truck",
    "\\uD83D\\uDCDE": "phone", "\\u2709": "mail", "\\uD83D\\uDD14": "bell", "\\uD83D\\uDC64": "user", "\\u2699": "settings",
    "\\uD83D\\uDCB3": "credit-card", "\\uD83D\\uDCB0": "wallet", "\\uD83D\\uDD25": "flame", "\\u23F0": "clock", "\\uD83D\\uDD51": "clock",
    "\\uD83C\\uDF81": "gift", "\\uD83C\\uDF9F": "ticket", "\\uD83D\\uDD11": "info",
    "\\uD83C\\uDF6B": "cookie", "\\uD83C\\uDF36": "flame", "\\uD83D\\uDCC5": "clock", "\\uD83D\\uDCCB": "list",
    "\\uD83D\\uDCF1": "phone", "\\uD83D\\uDCDD": "edit", "\\uD83D\\uDD0D": "search", "\\uD83D\\uDD0E": "search",
    "\\uD83C\\uDFEA": "store", "\\uD83C\\uDFE0": "home"
  };

  function migrateTextNode(node) {
    const text = node.nodeValue; if (!text) return;
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 3) return;
    const name = glyphMap[trimmed]; if (!name) return;
    const parent = node.parentElement;
    if (!parent || parent.closest(".cravio-svg") || parent.dataset.iconDone) return;
    parent.dataset.iconDone = "1";
    parent.innerHTML = svg(name, 18);
    parent.classList.add("ci");
  }

  function walk(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) migrateTextNode(node);
  }

  function upgradeDataIcons(root) {
    (root || document).querySelectorAll("[data-icon]").forEach(el => {
      if (el.dataset.iconDone) return;
      el.dataset.iconDone = "1";
      el.innerHTML = svg(el.dataset.icon, el.dataset.size ? Number(el.dataset.size) : 20);
      el.classList.add("ci");
    });
  }

  window.cravioIcon = svg;
  window.icon = svg;

  function init() {
    upgradeDataIcons();
    walk(document.body);
    const mo = new MutationObserver(records => {
      for (const r of records) {
        if (r.type === "childList") {
          r.addedNodes.forEach(n => {
            if (n.nodeType === 3) migrateTextNode(n);
            else if (n.nodeType === 1) { upgradeDataIcons(n); walk(n); }
          });
        } else if (r.type === "characterData") migrateTextNode(r.target);
      }
    });
    mo.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
`;

fs.writeFileSync(__dirname + "/../../frontend/js/icons.js", js);
console.log("icons.js written with", Object.keys(paths).length, "lucide icons");
