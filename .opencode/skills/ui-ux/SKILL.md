---
name: ui-ux
description: Cravio frontend design system — vanilla HTML/CSS/JS only. Use whenever touching frontend/*.html, frontend/css/*, or frontend/js/* for visual, layout, icon, or UX work. Defines tokens, icon system, component classes and hard constraints (no frameworks, no backend changes).
---

# Cravio UI/UX Design System

## Hard constraints
- **Stack:** plain HTML, vanilla CSS, vanilla JS only. No Tailwind, no Bootstrap, no icon font packages, no build step, no CDN component libraries. Google Fonts links and existing CDN images (Unsplash, Leaflet) are allowed.
- **Never** change business logic: API calls, cart behaviour, order flow, localStorage keys, auth token handling stay exactly as they are. UI work only.
- Keep every existing id/class that JS depends on. Add classes, don't remove them.
- Dark mode must keep working: all new colours via CSS custom properties, never hard-coded hex in components.

## Icon system (`js/icons.js`)
- Single source of truth: inline SVG sprite (24×24, stroke = currentColor, stroke-width 1.8, round caps/joins).
- Usage in HTML: `<span class="ci" data-icon="search"></span>` (optionally `data-size="18"`).
- Usage in JS templates: `icon("cart")` returns the SVG string.
- Emoji and glyph characters (☾ ♡ ★ ⌕ ✓ 🍽️ …) are **banned** in committed UI. Replace with named icons: moon, sun, heart, star, search, sliders, map-pin, check, sparkles, utensils, leaf, cup, flame, graduation-cap, zap, bell, user, cart, clock, phone, mail, ticket, wallet, credit-card, truck, store, home, trash, edit, eye, plus, minus, x, arrow-right, chevron-down, log-out, package, gift.
- Auto-migration: icons.js replaces standalone glyph text nodes at load and via MutationObserver, so legacy pages light up without editing every string.

## Design tokens (`css/design-system.css`)
- Load order on every page: Google Fonts → `css/styles.css` (or page css) → `css/design-system.css` last (it may override safely).
- Tokens: `--c-orange #f36b32`, `--c-orange-deep #d94f1c`, `--c-cream #fffdf9`, `--c-ink #25211e`, `--c-green #287a50`, `--c-gold #c58a18`, radii 10/14/22, `--shadow-1/2`, spacing scale ×4.
- Type: DM Sans (UI), Plus Jakarta Sans (headings), tabular numerals for prices/ratings.

## Component conventions
- Buttons: `.btn` (solid orange), `.btn-ghost` (bordered), `.btn-dark` (ink). Min-height 40px, radius 10, 700 weight, focus-visible ring `0 0 0 3px rgba(243,107,50,.28)`.
- Cards: radius 14–22, 1px `var(--line)` border, hover lift translateY(-3px) + shadow-2, 200ms ease.
- Badges: 10–11px, 800 weight, letter-spacing .5px, pill radius.
- Inputs: 44px min height, radius 10, border `--line`, focus border orange + ring.
- Nav: sticky, icon + label links, active state orange with 3px underline offset.
- Empty states: icon in soft circle, title, muted line, action button.
- Toasts/feedback: existing `.toast` pattern; success green, error #c0392b.
- Motion: 150–250ms transitions only; respect `prefers-reduced-motion`.

## Layout rules
- Content width `min(1120px, 90vw)` (`.page-wrap`).
- Mobile-first checks at 900px and 600px; nav collapses to icon row, grids stack.
- Images: `object-fit: cover`, fixed aspect boxes, `loading="lazy"`.
