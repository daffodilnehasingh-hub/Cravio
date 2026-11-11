/* One-off: inject favicon + design-system.css + icons.js into every Cravio page. Idempotent. */
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "frontend");
const pages = fs.readdirSync(dir).filter(f => f.endsWith(".html"));
let touched = 0;

for (const file of pages) {
  const full = path.join(dir, file);
  let html = fs.readFileSync(full, "utf8");
  const before = html;

  if (!html.includes('rel="icon"')) {
    if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, '  <link rel="icon" type="image/svg+xml" href="favicon.svg" />\n</head>');
  }
  if (!html.includes("css/design-system.css")) {
    if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, '  <link rel="stylesheet" href="css/design-system.css" />\n</head>');
  }
  if (!html.includes("js/icons.js")) {
    if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, '  <script src="js/icons.js"></script>\n</head>');
  } else {
    // legacy placement: strip body-level tag, re-insert in head (sync, before other scripts)
    html = html.replace(/\s*<script src="js\/icons.js" defer><\/script>\s*/gi, "\n");
    if (!/<head[^>]*>[\s\S]*js\/icons\.js/.test(html) && /<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, '  <script src="js/icons.js"></script>\n</head>');
    }
  }

  if (html !== before) { fs.writeFileSync(full, html); touched++; console.log("updated:", file); }
}
console.log(`done. ${touched}/${pages.length} pages updated.`);
