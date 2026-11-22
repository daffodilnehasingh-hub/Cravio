# Cravio MVP - Phases 1-4

## Pages
- `frontend/index.html` - Home, categories, search, filters and theme toggle.
- `frontend/restaurants.html` - Restaurant and canteen directory.
- `frontend/menu.html` - Outlet details, food menu and demo cart.
- `frontend/checkout.html` - Delivery/pickup selection, address form, coupons, demo student discount, payment selection and order confirmation.

## Run locally
1. Extract the ZIP.
2. Open the `frontend` folder in VS Code.
3. Start `index.html` using Live Server.
4. Browse outlets -' Explore menu -' Add dishes -' View cart -' Continue to checkout.

## Phase 4 behaviour
- Choose home delivery or self pickup.
- Delivery-only address validation (name, 10-digit phone, 6-digit PIN and address).
- Canteens marked as pickup-only automatically select pickup and block delivery.
- Demo delivery fee: ,125 below ,1299; free at ,1299 and above.
- Demo coupon codes: `CRAVIO10` (10%) and `CAMPUS15` (15%).
- Student discount checkbox gives a demo 15% discount. Real student verification is not implemented yet.
- Payment methods are UI selections only; no payment gateway is connected.
- On place order, a demo order is saved in localStorage as `cravio-last-order` and added to `cravio-order-history`; cart is cleared.

## Important MVP limitations
All outlet, menu, cart and order data are currently browser-side demo data. No real authentication, server-side price validation, MongoDB persistence, payment processing, restaurant order notification or delivery dispatch exists yet. Do not use this frontend-only demo to accept real payments or real customer orders.

## Next phase
Build Node.js + Express + MongoDB APIs, JWT authentication and server-side order validation. Then connect the frontend to those APIs.