# Cravio MVP — Phases 1–4

## Pages
- `frontend/index.html` — Home, categories, search, filters and theme toggle.
- `frontend/restaurants.html` — Restaurant and canteen directory.
- `frontend/menu.html` — Outlet details, food menu and demo cart.
- `frontend/checkout.html` — Delivery/pickup selection, address form, coupons, demo student discount, payment selection and order confirmation.

## Run locally
1. Extract the ZIP.
2. Open the `frontend` folder in VS Code.
3. Start `index.html` using Live Server.
4. Browse outlets → Explore menu → Add dishes → View cart → Continue to checkout.

## Phase 4 behaviour
- Choose home delivery or self pickup.
- Delivery-only address validation (name, 10-digit phone, 6-digit PIN and address).
- Canteens marked as pickup-only automatically select pickup and block delivery.
- Demo delivery fee: ₹25 below ₹299; free at ₹299 and above.
- Demo coupon codes: `CRAVIO10` (10%) and `CAMPUS15` (15%).
- Student discount checkbox gives a demo 15% discount. Real student verification is not implemented yet.
- Payment methods are UI selections only; no payment gateway is connected.
- On place order, a demo order is saved in localStorage as `cravio-last-order` and added to `cravio-order-history`; cart is cleared.

## Important MVP limitations
All outlet, menu, cart and order data are currently browser-side demo data. No real authentication, server-side price validation, MongoDB persistence, payment processing, restaurant order notification or delivery dispatch exists yet. Do not use this frontend-only demo to accept real payments or real customer orders.

## Next phase
Build Node.js + Express + MongoDB APIs, JWT authentication and server-side order validation. Then connect the frontend to those APIs.


## Phase 5: Backend authentication

The `backend/` folder contains the Node.js + Express + MongoDB authentication API.
See `backend/README.md` for setup. Copy `backend/.env.example` to `backend/.env`,
configure your MongoDB URI and JWT secret, then run `npm install` and `npm run dev`
inside `backend/`. Use `frontend/login.html` and `frontend/register.html` with Live Server.


## Phase 6: Profile and account management
- `frontend/profile.html` displays the signed-in user's profile.
- `GET /api/auth/me` loads the profile; `PATCH /api/auth/me` updates name and phone.
- Logged-out or expired sessions are redirected to `login.html`.
- Log out clears the demo browser token and user data.


## Phase 7: MongoDB order management
- Authenticated customers can create orders through `POST /api/orders`.
- Order totals and item prices are calculated on the server from the demo catalogue.
- Customers can view their order history at `frontend/orders.html`.
- Admin/vendor endpoints are protected by role middleware: `GET /api/orders/manage` and `PATCH /api/orders/:id/status`.
- Demo catalogue item IDs/prices are in `backend/config/catalogue.js`; keep them aligned with the menu data.
- This is still an MVP: online payment is not processed, and admin/vendor account provisioning is not included.


## Phase 8: Tracking and outlet dashboard
- Customers can expand **Track this order** on `frontend/orders.html` to see status history and timestamps.
- Use **Refresh status** to fetch the latest status from the API.
- Admins and vendors can open `frontend/dashboard.html` to manage incoming orders.
- Vendors are restricted to outlet IDs in their `managedOutletIds` account field.
- New accounts are customers by default. Assign `admin` or `vendor` roles only from a trusted MongoDB/admin process; set vendor `managedOutletIds`, e.g. `["2"]`, and have the vendor log in again to receive an updated JWT.


## Phase 9: Student verification and discounts
- Customers submit a JPG/PNG/WEBP college ID (maximum 5 MB) at `frontend/student-verification.html`.
- Configure Cloudinary credentials in `backend/.env`; ID files are uploaded using Cloudinary's `authenticated` delivery type.
- Admins review pending requests at `frontend/admin-verifications.html`; approve/reject decisions are protected by the admin role.
- Only `isStudentVerified: true` in MongoDB enables the student discount calculation on the backend.
- New accounts remain unverified by default. Admin accounts must be assigned securely in MongoDB; never allow public role selection.


## Phase 10 – Real-time delivery tracking

### Install and run
1. Open a terminal in `backend` and run `npm install` (this installs Socket.IO too).
2. Ensure MongoDB, `JWT_SECRET`, `MONGODB_URI`, and the Phase 9 Cloudinary settings are configured in `backend/.env`.
3. Start the API with `npm run dev`.
4. Serve the `frontend` folder using Live Server or another local web server. Add its exact origin to `CORS_ORIGIN` in `.env` if it differs from the defaults.
5. Open `dashboard.html` as an admin/vendor to assign delivery partners. Open `delivery-dashboard.html` after signing in with a delivery account. Customers can open live tracking from their order history after a delivery partner has been assigned.

### Assigning test roles
Public sign-up intentionally creates customer accounts only. To test the delivery workflow, create a normal account, then change its `role` field in MongoDB to `delivery`. For a vendor, set `role: "vendor"` and `managedOutletIds` to the outlet IDs they manage. For admin testing, set `role: "admin"`. Log out and log in again after changing a role so a fresh token is issued. Never expose admin role assignment in public registration.

### What Phase 10 adds
- Admin/vendor can assign a delivery-role account and set an ETA (1–240 minutes).
- Delivery partners see only their assigned active jobs.
- Delivery partners can start a delivery, share browser GPS while it is active, and mark it delivered.
- Customers can see the partner's latest location on an OpenStreetMap map. Socket.IO broadcasts updates only to an authorized order room.
- Browser geolocation requires user permission. It generally works on `localhost` for development; deployed sites must use HTTPS.

### Important limitations
This is an MVP tracking implementation, not turn-by-turn navigation. The ETA is manually entered by the outlet/admin, not calculated from traffic. Location sharing is started by the delivery partner and should stop when delivery is complete or the page is closed. Production deployment needs stronger operational monitoring, rate limits for location updates, secure deployment configuration, privacy notice/consent, data retention and deletion rules, and a proper delivery-partner onboarding process. OpenStreetMap tiles and Leaflet are loaded from public CDNs.


## Phase 11 – Ratings, reviews and favorites

### Features
- Customers can submit one 1–5 star rating per completed/delivered or picked-up order, with an optional comment (up to 500 characters).
- Reviews are linked to the exact order and outlet. The API rejects reviews for orders that are not complete and prevents duplicate reviews.
- Outlet review pages show customer comments, average rating and review count.
- Outlet directory cards show ratings calculated from Cravio reviews (outlets without reviews show “New”).
- Logged-in customers can save/remove favorite outlets and manage them from `favorites.html`.

### API routes
- `POST /api/reviews` – submit a review (customer JWT required).
- `GET /api/reviews/outlet/:outletId` – public reviews for one outlet.
- `GET /api/reviews/summary` – public rating summaries for all outlets.
- `GET /api/reviews/my` – current customer's reviews.
- `GET /api/favorites` – current customer's favorite outlets.
- `POST /api/favorites/:outletId` – save an outlet.
- `DELETE /api/favorites/:outletId` – remove an outlet.

No extra npm package is required for this phase. The `favoriteOutletIds` field is added to User; MongoDB documents receive its default when saved/updated through Mongoose. The new Review collection is created automatically when the first review is submitted.


## Phase 12 – Cancellation, reorder and receipts

### Customer features
- Cancel an order only while its status is `placed` (before outlet acceptance). The customer can optionally provide a reason (up to 300 characters).
- The cancellation is recorded in order status history with a timestamp and is broadcast to the authorized Socket.IO order room.
- Reorder copies the saved order lines into the cart and opens the same outlet menu. It replaces the current cart after confirmation; current prices are revalidated by the server at checkout.
- View a receipt for an order and print/save it using the browser print dialog.

### API addition
- `PATCH /api/orders/:id/cancel` – customer can cancel only their own order while status is `placed`. Body: `{ "reason": "..." }`.

### Important payment note
Cravio's UPI/COD options are still demo payment selections; this phase does not process payments or issue refunds. If a customer paid through a real payment gateway in a future release, refunds must be handled through that gateway and reconciled separately.


## Phase 13: Customer support tickets
- Customers can submit support requests from `frontend/support.html`, optionally linking one of their own orders.
- Customers can view the conversation and reply while a ticket is open or in progress.
- Admins can open `frontend/admin-support.html`, review all tickets, reply and set status to open, in progress, resolved or closed.
- API: `POST /api/support`, `GET /api/support/my`, `GET /api/support/manage` (admin), `POST /api/support/:id/reply`.
- Ticket ownership is checked on the server. Customers cannot link another customer's order or view/reply to another customer's ticket.
- This is an in-app support inbox only; email, WhatsApp and push notifications are not configured.
- To test admin support, sign in with an account whose database `role` is `admin`, then open `admin-support.html`.


## Phase 14: In-app notifications
- Notifications are persisted in MongoDB and scoped to the signed-in user.
- Customers receive notifications for order placement, outlet status changes, delivery progress, cancellations and admin support replies.
- `frontend/notifications.html` lists notifications, links to related pages and supports mark-as-read / mark-all-as-read.
- API: `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`.
- Socket.IO emits a `notification:new` event to the authenticated user's private socket room when a notification is created. The current page uses database refresh; a live badge/toast can be added in a later UI enhancement.
- Notifications are in-app only; browser push, SMS and email are not configured.


## Phase 15: Admin coupon management
- Admin page: `frontend/admin-coupons.html`.
- Admins create coupons with percentage/fixed discounts, minimum basket, maximum discount, outlet type, usage limit and expiry.
- Admins can activate/deactivate existing coupons.
- Customer checkout validates coupon through `POST /api/coupons/validate`; the order API independently checks coupon rules and calculates the discount server-side.
- Admin APIs: `GET /api/coupons`, `POST /api/coupons`, `PATCH /api/coupons/:id` (admin only).
- Validation API: `POST /api/coupons/validate` (authenticated).
- Existing hard-coded CRAVIO10 and CAMPUS15 codes are no longer automatically accepted. Create them from the admin page if you want to retain those offers.
- Usage counter is incremented after successful order creation; for high-traffic production use, replace this with an atomic reservation/transaction to prevent concurrent over-redemption.


## Phase 16: Database-driven outlets and menus
- MongoDB `Outlet` model stores outlet details and menu items.
- Public APIs: `GET /api/outlets` and `GET /api/outlets/:outletId/menu`.
- Admin/vendor management APIs: `GET /api/outlets/manage/all`, `PATCH /api/outlets/:outletId`, `POST /api/outlets/:outletId/items`, `PATCH /api/outlets/:outletId/items/:itemId`, `DELETE /api/outlets/:outletId/items/:itemId`.
- Admin-only outlet creation: `POST /api/outlets`.
- `frontend/outlet-management.html` provides a basic outlet/menu management screen. Vendors see only outlets assigned to their account.
- Order creation checks active MongoDB outlets first and validates each menu item and price from MongoDB; legacy hard-coded catalogue remains as a fallback for old demo outlets.
- To import the six existing demo outlets into MongoDB, from `backend/` run `node scripts/seedOutlets.js` after setting `.env`. The script inserts only missing outlet records and does not overwrite existing data.
- For new menu items, create the outlet in admin manager, then add items. The listing screen loads database outlets; the older demo menu page still contains its original seed menu presentation, so new custom menu UI integration is a follow-up enhancement. Orders for DB-created menu item IDs are accepted by the backend when submitted.
- For production, add outlet ownership approval, image upload/storage, audit history, and atomic inventory/availability controls.

## Phase 17 – Fully dynamic customer menu
- `frontend/js/menu.js` now requests `GET /api/outlets/:outletId/menu` and builds menu categories and dish cards from the MongoDB outlet document.
- Only items with `available: true` (or missing availability in legacy data) are displayed. Veg/non-veg filters, search, category filters and quantity controls work with database string item IDs.
- If the API is unavailable or the outlet cannot be loaded, the bundled demo outlet/menu remains available as a fallback. If a database outlet exists but has no menu items, the page uses its existing demo menu when one is available for that outlet.
- The selected outlet details are saved in localStorage so checkout can show the database outlet name and respect its delivery/pickup settings. Checkout still submits item IDs and quantities to the backend; the backend remains the source of truth for prices.
- Run the backend, ensure MongoDB is connected and seeded (`npm run seed:outlets` from `backend`), then open `frontend/restaurants.html`, choose an outlet, and open its menu. Add/edit items from the outlet management page and refresh the customer menu to see the changes.

## Phase 18 – Razorpay online payments
- Added the Razorpay Node SDK and environment variables `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Use test keys from the Razorpay Dashboard while developing; never put the secret in frontend code or commit a real `.env` file.
- Checkout now offers Razorpay as the online payment option. The browser opens the official Razorpay Checkout script, then posts the returned payment details to `POST /api/orders/payment/verify`.
- `POST /api/orders` accepts `paymentMethod: "razorpay"`, creates a Cravio order in `payment_pending`, creates a Razorpay order in INR paise, and returns only the public key ID to the browser.
- The server verifies the Razorpay HMAC-SHA256 signature using the secret, checks the pending order belongs to the logged-in customer, then marks it paid and changes its status to `placed`. Coupon usage and customer notification happen only after successful verification. `POST /api/orders/payment/fail` closes a still-pending order when Checkout is dismissed or reports failure.
- COD and pay-at-outlet flows remain unchanged. The old UPI demo option is now Razorpay Checkout.
- Setup: in `backend/`, run `npm install`, copy `.env.example` to `.env`, set MongoDB/JWT values and Razorpay test keys, then run `npm run dev`. Serve `frontend/` through a local web server. For deployment, configure HTTPS and production Razorpay keys only after testing.
- Test using Razorpay's official test payment methods. Do not use real customer cards or credentials in test mode. A dismissed or failed Checkout is not an order confirmation; its Cravio record remains in `payment_pending` for operational cleanup.
- The backend Content Security Policy now allows Razorpay Checkout scripts/frames and its API connections. Production hardening still required: configure Razorpay webhooks (verify webhook signatures using the raw request body), reconcile payment status server-to-server, add an expiry/cleanup job for abandoned pending orders (for example, if the browser closes before the failure request), use atomic coupon redemption, and test refunds/disputes. The browser callback alone should not be treated as the only source of payment truth in a production deployment.


## Phase 19 – Email OTP verification
- New customer registrations are created as unverified and receive a six-digit email verification code.
- Codes are stored as SHA-256 hashes, expire after 10 minutes, and are limited to five incorrect attempts. Resending is throttled to once per minute.
- New accounts receive a login token only after the email address is verified. Existing accounts default to verified so previously created users are not locked out.
- API additions: `POST /api/auth/verify-email` with `{ email, otp }` and `POST /api/auth/resend-verification` with `{ email }`.
- Registration page includes the verification form; login explains when verification is required and offers a resend action.
- Email is sent through SMTP using Nodemailer. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and optionally `EMAIL_FROM` in `backend/.env`. For Gmail, use an App Password rather than your normal account password.
- Install dependencies in `backend/` with `npm install`, then restart the API. Existing `.env` files must be updated manually from the new `.env.example`.
- If SMTP is not configured or delivery fails, the account remains unverified; configure SMTP and use the resend option. Do not expose SMTP credentials in frontend code or commit `.env`.
- This phase verifies email ownership only. It does not yet implement password reset, SMS OTP, marketing emails, or email notifications for every order event.


## Phase 20 – Forgot password and secure reset
- Login page includes a forgot-password flow. The user requests a code by email, enters the 6-digit code, and chooses a new password.
- API additions:
  - `POST /api/auth/request-password-reset` with `{ email }`
  - `POST /api/auth/reset-password` with `{ email, otp, newPassword }`
- Reset codes are generated using a cryptographically secure random generator, stored as SHA-256 hashes, expire after 10 minutes, and are limited to five incorrect attempts. Resend requests are throttled to one per minute.
- The request endpoint returns a generic response for unknown email addresses to reduce account enumeration. SMTP delivery uses the existing Nodemailer configuration from Phase 19.
- New password must be at least 8 characters and no more than 128 characters. It is hashed with bcrypt before saving. Reset codes are cleared after successful use.
- After resetting, the user must log in with the new password. This phase does not automatically revoke JWTs already issued to other devices; production deployment should add token-version/session revocation and persistent rate limiting (for example, Redis-backed limits).
- No new SMTP settings are required if Phase 19 email verification is already configured. Restart the backend after updating the project.


## Phase 21 – Admin and vendor analytics dashboard
- Added `frontend/admin-analytics.html` with an analytics view for admins and vendors.
- New authenticated endpoint: `GET /api/analytics/summary?days=7|30|90`.
- Summary metrics include total, active, completed and cancelled orders; confirmed order value; average order value; Razorpay-collected amount; and item quantities sold.
- Includes daily order-value chart, order-status breakdown, popular dishes ranked by quantity, and outlet performance.
- Admins see all outlets. Vendors are scoped to outlet IDs in their `managedOutletIds` claim.
- Payment reporting is deliberately labelled: order value excludes cancelled orders, while Razorpay collected includes only records marked `paymentStatus: paid`. COD and pay-at-outlet amounts are not presented as collected revenue.
- Link to analytics is available from the existing order dashboard. Access is protected by JWT and the backend `admin`/`vendor` role check.
- This is an operational summary, not an accounting ledger. Refunds, taxes, gateway fees, cash reconciliation, exports, and date-picker reporting are not included yet.


## Phase 22 – Inventory and stock management
- Added stock quantity and low-stock threshold fields to every database-backed menu item.
- New menu items start with 50 units by default in the outlet manager (editable before submission); the low-stock threshold defaults to 5.
- Added admin/vendor inventory API:
  - `GET /api/outlets/manage/inventory`
  - `PATCH /api/outlets/:outletId/items/:itemId/stock` with `{ stockQuantity, lowStockThreshold }`
- Added `frontend/inventory.html` with item stock, low-stock and out-of-stock counts, quantity editing and alert threshold editing.
- Admins can see all outlets. Vendors can only see and update outlets listed in their `managedOutletIds`.
- Checkout performs atomic stock decrements against MongoDB. If stock is insufficient, the order is rejected with the available quantity. If a multi-item stock deduction partially fails, earlier deductions are rolled back.
- Stock is reserved when a database-backed order is placed, including while Razorpay payment is pending. Failed/uncompleted Razorpay payments restore stock. Eligible customer cancellations and admin/vendor cancellations restore stock. Completed orders keep the deduction.
- Menu API marks zero-stock items unavailable, so customers cannot add them from the dynamic menu. The existing menu manager can disable/enable an item; an item cannot be enabled with zero stock.
- Existing MongoDB outlet items need a one-time stock migration. In `backend/`, run `npm install` then `npm run migrate:inventory`. Items without stock are initialized to 50 and low-stock threshold to 5. Review those initial quantities and adjust them to real counts before accepting live orders.
- Stock handling is currently for MongoDB-backed outlets. Legacy hardcoded catalogue fallback outlets do not have inventory records. For production, add database transactions or a dedicated inventory ledger and reconciliation to cover process crashes during multi-item checkout.


## Phase 23 – Delivery partner management
- Added admin-only delivery partner management at `frontend/delivery-management.html`.
- Admins can create delivery partner accounts with name, email, phone, initial password, vehicle type/number and emergency contact; update availability; and enable/disable accounts.
- New API routes under `/api/delivery-partners`:
  - `GET /` – list delivery partners with assignment/completion statistics (admin only)
  - `POST /` – create a delivery partner account (admin only)
  - `PATCH /:id` – update profile/availability/active state (admin only)
  - `GET /me` – delivery partner profile and own statistics
  - `PATCH /me/availability` – delivery partner sets available/offline
- Vendors cannot create, list, disable or update delivery partner accounts. They may still assign an available partner to delivery orders from their assigned outlet.
- Assignment atomically changes a partner from available to busy, preventing the same partner from being selected for simultaneous assignments. The partner becomes available again after marking the delivery complete.
- Delivery partners can set themselves offline when they have no active delivery. A partner cannot go offline or be disabled while an assigned order is ready/out for delivery.
- Existing delivery role accounts remain valid. Their new fields default to active/available; update vehicle/contact details through the admin management screen.
- New accounts are created with email verified so they can log in immediately. Admin must securely communicate the initial password; the account creation form does not email credentials. Partners should change their password after first login (a forced password-change flow is a future improvement).
- Performance counts are based on assigned order records. Delivered value is the sum of delivered order totals, not a payroll or payout calculation.


## Phase 24 – Advanced search, filters and sorting
### Outlet discovery (`frontend/restaurants.html`)
- Search outlets by name, cuisine, description or outlet type; `?q=` can prefill a search.
- Filter by restaurant/canteen tab, delivery, pickup, budget, maximum starting price, minimum rating and cuisine.
- Sort by recommended order, customer rating, lowest starting price or outlet name.
- Minimum rating and top-rated sorting use database review summaries when available.
- Outlet identifiers remain strings so custom outlet IDs are not converted to `NaN`.
- Outlets with no available menu items are assigned a high starting-price sentinel and naturally disappear under finite price filters.

### Menu discovery (`frontend/menu.html`)
- Search across dish name, description and category.
- Filter by category, vegetarian/non-vegetarian and maximum price.
- Sort by recommended order, price ascending/descending, rating or name.
- Result count updates as filters change; Reset filters restores the full menu.
- A successful database response with zero available items now correctly shows the empty-menu state instead of showing bundled demo dishes. Bundled demo menu remains a fallback only when the API request fails.

### Validation
- Frontend remains HTML, CSS and vanilla JavaScript.
- No new backend endpoints or database migration are required.


## Phase 25 – Homepage personalization and recommendations
- Homepage now requests live recommendations from MongoDB-backed outlet menus rather than relying on its hard-coded sample dishes.
- Added `GET /api/outlets/recommendations` for popular dishes based on aggregate order quantities. Cancelled and payment-pending orders are excluded.
- Added authenticated `GET /api/outlets/recommendations/me`; recommendations prioritize dishes the signed-in customer has ordered before. If there is no usable history, the endpoint falls back to available fresh menu items.
- Recommendations include only active outlets and available, in-stock menu items.
- Homepage cards show outlet, category, price, food type, image and recommendation reason.
- Customers can open the outlet menu or add a recommended item directly to the existing localStorage cart. The same-outlet cart restriction is preserved, and selected outlet context is saved for checkout.
- If recommendation APIs are unavailable, the homepage uses its original demo food cards. Demo fallback cards route customers to Explore rather than inserting fake product IDs into checkout.
- Search still filters homepage recommendations and redirects to Explore search when no homepage match exists.
- No new package, migration or external service is required.


## Phase 26 — Razorpay payment verification hardening

The checkout already opens Razorpay Checkout. This phase strengthens the server-side confirmation path:
- Verifies the Razorpay Checkout signature with HMAC SHA-256 and timing-safe comparison.
- Fetches the payment directly from Razorpay and checks the gateway order ID, exact amount in paise, INR currency, and captured status before confirming a Cravio order.
- Uses a conditional database update so repeated callbacks cannot confirm the same order twice.
- A browser dismiss/failure request no longer blindly cancels an order: the server checks Razorpay for authorized/captured payments first.
- The frontend uses the customer prefill details returned by the backend and advises customers to check My Orders if verification is delayed.

### Configure Razorpay test mode
1. Create or sign in to a Razorpay account and enable **Test Mode** in the dashboard.
2. Generate a Test Key ID and Test Key Secret.
3. Copy them into `backend/.env` (never into frontend files):
   - `RAZORPAY_KEY_ID=rzp_test_...`
   - `RAZORPAY_KEY_SECRET=...`
4. Restart the backend after changing `.env`.
5. Keep automatic capture enabled in Razorpay so successful payments reach the `captured` state.
6. Test checkout with Razorpay's test payment details from its dashboard documentation. Do not use real customer card/UPI details in test mode.

### Important
- The ZIP contains only placeholders in `.env.example`; it does not contain live credentials.
- A real payment can be accepted only after valid Razorpay account keys and dashboard settings are configured.
- Do not mark an order as paid based only on the browser callback. Cravio verifies it on the backend.
- If the checkout closes or the browser loses connection after payment, check **My Orders** before trying again. A payment may be processing while the confirmation request is being retried.
- For production deployment, configure Razorpay webhooks (with a separate webhook secret) and reconcile pending payments server-side; also configure HTTPS and review Razorpay's production checklist.


## Phase 27 — Razorpay webhooks and payment reconciliation

Cravio now exposes a server-to-server webhook endpoint:
- `POST /api/webhooks/razorpay`
- The route is mounted before JSON parsing and verifies `X-Razorpay-Signature` against the exact raw request bytes.
- `payment.captured` events confirm matching pending Cravio orders only after amount and INR currency checks.
- Duplicate webhook deliveries are safe: an already-paid order is acknowledged without incrementing coupon usage again.
- `payment.authorized`, `payment.failed`, and unrelated events are acknowledged but do not confirm an order.
- A successful webhook emits the order update through Socket.IO and sends the customer a notification.
- A small Phase 26 verification-handler reassignment bug is also corrected.

### Configure the Razorpay webhook
1. In the Razorpay Dashboard, switch to the same mode as your API keys (Test Mode for testing).
2. Open **Account & Settings → Webhooks** and add this URL:
   `https://YOUR_PUBLIC_DOMAIN/api/webhooks/razorpay`
3. Subscribe to the `payment.captured` event.
4. Generate a webhook secret in the dashboard and copy it to backend `.env`:
   `RAZORPAY_WEBHOOK_SECRET=your_webhook_secret`
5. Restart the backend and use the dashboard's webhook test feature if available.
6. Keep the webhook secret separate from `RAZORPAY_KEY_SECRET`. Never place either secret in frontend code or commit `.env`.

### Local development
Razorpay cannot call `localhost` directly. Use a secure public HTTPS tunnel to your local backend (for example, a development tunnel) and configure the resulting HTTPS URL as the webhook URL. Remove or rotate temporary tunnel endpoints and secrets when finished.

### Production notes
- Deploy the backend behind HTTPS and configure the webhook URL on your production domain.
- Configure the webhook separately for Test Mode and Live Mode.
- Monitor webhook delivery attempts and server logs. A 2xx response means Cravio accepted the event; a 5xx response allows Razorpay to retry.
- This phase handles captured-payment confirmation. Refunds, disputes, chargebacks, and automated stale-pending-order expiry are separate workflows and are not silently treated as successful payments.

- Browser dismiss/failure callbacks no longer cancel or release stock immediately. They may race with delayed gateway capture events; the order remains pending until a definitive payment event or a later expiry/reconciliation workflow.


## Phase 28 — Pending-payment expiry and reconciliation

This phase adds an automatic backend worker for Razorpay orders that remain `payment_pending`:
- Razorpay orders are created with a 30-minute `expire_by` window, and the matching Cravio order stores `paymentPendingExpiresAt`.
- A reconciliation worker starts after MongoDB connects, runs immediately, then checks every two minutes (maximum 30 pending orders per pass).
- It queries Razorpay directly for the gateway order and payment attempts.
- A captured payment is reconciled to `paid` / `placed`, with coupon usage, customer notification and Socket.IO update.
- Authorized payments remain pending; transient Razorpay/network errors never trigger stock release.
- An expired Razorpay order, or an order whose attempts are all terminally failed after the expiry grace period, is cancelled and reserved inventory is restored.
- The close operation uses a conditional database update so only one worker instance can win the cancellation and stock-release claim.
- No additional npm package is required.

### Expiry behavior
- Customer payment window: 30 minutes.
- Reconciliation grace period: 5 minutes after the stored expiry.
- Worker interval: every 2 minutes.
- If Razorpay cannot be reached, the order remains pending and stock stays reserved. The worker retries on its next run.
- Existing pending orders created before this phase may not have `paymentPendingExpiresAt`; they are not automatically expired by this worker. Review those manually or set a valid expiry in the database after checking Razorpay.

### Operational note
The worker is part of each running backend process. The conditional database update prevents multiple instances from closing the same order, but for a high-volume production deployment, move scheduled reconciliation to a dedicated worker process and use durable job/stock-adjustment records plus monitoring. Configure the Razorpay webhook from Phase 27 as well; webhook delivery and reconciliation are complementary safeguards.


## Phase 29 — Customer refund requests and admin processing

### Customer flow
- Customers can request a full refund for a paid Razorpay order after it is cancelled, delivered, or picked up.
- A reason is required (maximum 500 characters).
- One refund request is allowed per order.
- The My Orders page shows the refund state and only displays the request button for eligible orders.
- COD, pay-at-outlet, pending, failed, and unpaid orders cannot use this online refund workflow.

### Admin flow
- Open `frontend/admin-refunds.html` while signed in as an admin.
- Review the order, customer, payment ID, amount and customer reason.
- Reject a newly submitted request with an optional note, or approve it to create a full refund through Razorpay.
- The refund request uses the Razorpay `X-Refund-Idempotency` header and retains its idempotency key if the API response is uncertain, allowing a safe retry.
- A failed final attempt can be retried with a new idempotency key. A request in the processing state reuses the same key.
- Refunds may remain pending after initiation; final payment status changes to `refunded` only when Razorpay reports the refund as processed.

### Webhook configuration
In addition to `payment.captured` from Phase 27, subscribe to:
- `refund.processed`
- `refund.failed`

The signed webhook updates the stored refund state, payment status and customer notification. It can also handle the small race where a refund event arrives before the API response has saved the Razorpay refund ID.

### Important
- This phase processes full refunds only; partial refunds are not offered in the customer UI.
- Admin approval sends an actual refund request in whichever Razorpay mode is configured. Use Test Mode keys while developing.
- Razorpay may process a normal refund over several working days. "Refund initiated" is not the same as "refund credited to the customer's bank".
- The backend uses Node's built-in `fetch` (Node.js 18 or later) to send the idempotent refund request.


## Phase 30 – Admin Control Center

- Open `frontend/admin-control.html` after starting the backend and signing in with an admin account.
- The admin-only `GET /api/analytics/admin-overview` endpoint summarizes customer, outlet, vendor, delivery partner, order, refund, support-ticket and coupon counts.
- The page links to the existing order dashboard, analytics, refund queue, support inbox, student verification and coupon manager; it consolidates navigation rather than duplicating those workflows.
- Recent platform orders are shown with customer, outlet, amount, status and date.
- Access is checked in the browser and enforced again by the backend `admin` role middleware.


## Phase 31 – Customer Management

- Open `frontend/admin-customers.html` or use the Customer management shortcut in `frontend/admin-control.html`.
- Admin-only API routes are mounted at `/api/admin/customers`:
  - `GET /` searches customers by name, email or phone and supports active/inactive filters and pagination.
  - `GET /:id` returns a customer profile and the latest 30 non-payment-pending orders.
  - `PATCH /:id/status` activates or deactivates a customer account.
- The customer list includes account status, email/student verification, order count and total non-cancelled order value.
- Deactivated accounts are denied access by the login endpoint and authenticated API middleware. The middleware reads current role and active status from MongoDB so an older JWT cannot bypass deactivation or a role change.
- Only accounts with the `customer` role can be managed through these endpoints; admin, vendor and delivery accounts are not affected.
- No database migration or new package is required.


## Phase 32 – Advanced Outlet Management

- Open `frontend/admin-outlets.html` directly or use Outlet management in `frontend/admin-control.html`.
- Admin-only endpoints:
  - `GET /api/outlets/admin/manage` lists outlets with search, approval-status and outlet-type filters, plus active vendor accounts.
  - `PATCH /api/outlets/admin/:outletId/approval` approves, rejects or returns an outlet to pending; a pending or rejected outlet is made inactive.
  - `PATCH /api/outlets/admin/:outletId/availability` suspends or activates an approved outlet.
  - `PATCH /api/outlets/admin/:outletId/vendor` assigns an active vendor or removes the assignment. Both `Outlet.managedBy` and the vendor's `managedOutletIds` are updated.
- Admins can register a new restaurant or canteen from the same page. Admin-created outlets start approved but inactive/active state follows the existing outlet defaults.
- Public outlet listings, menu retrieval, recommendations and order creation now require outlets to be active and approved.
- `approvalStatus` defaults to `approved`; public queries also include older documents where this field does not yet exist, preserving existing outlets without a database migration. No new package is required.


## Phase 33 – Vendor Dashboard Improvements

- Open `frontend/vendor-dashboard.html` using a vendor account.
- The workspace combines the existing vendor-scoped endpoints:
  - `GET /api/analytics/summary?days=30` for 30-day order, sales, status, daily and top-dish insights.
  - `GET /api/orders/manage` for incoming orders from the vendor's assigned outlets.
  - `GET /api/outlets/manage/all` for the vendor's assigned outlet and menu details.
- Vendor dashboard metrics include orders, active/completed/cancelled orders, gross order value, average order value, items sold, verified online collections and assigned outlet count.
- Outlet performance lists all assigned outlets, including outlets with no sales in the selected period.
- Incoming orders can be filtered by outlet and order status. Vendors can update order status through the existing outlet-ownership-checked endpoint.
- Quick links open order operations, menu management, inventory and detailed analytics.
- Access remains vendor-only at the page level; backend endpoints continue to enforce current vendor role and assigned outlet IDs. No new endpoint, migration or dependency is required.


## Phase 34 – Vendor Menu Management Improvements
- Rebuilt the outlet/menu manager as a responsive Menu Studio.
- Added menu search, category and availability filters.
- Added item editing for name, category, price, description, vegetarian status and image URL.
- Added bulk percentage price adjustments for selected menu items.
- Added image thumbnails/previews and clearer stock/availability presentation.
- Added a protected bulk-price API with vendor outlet-ownership checks, selection validation and percentage bounds (-90% to +200%).
- Existing add, enable/disable and remove workflows remain available.
- No database migration required.


## Phase 35 – Advanced Vendor Order & Kitchen Management
- Added a dedicated responsive Kitchen Display page at `frontend/vendor-kitchen.html`.
- Kitchen queue shows incoming placed, accepted, preparing and ready orders, with outlet and stage filters.
- Orders are displayed oldest-first to help staff prioritize the queue.
- Added accept, start preparation and mark ready actions with optional kitchen notes.
- Added preparation-time estimates (1–240 minutes), target countdown/overdue indication, and order stage timestamps.
- Enhanced order management API filters for status, outlet and fulfillment type.
- Vendor order progression is validated server-side: placed → accepted → preparing → ready; vendor outlet ownership remains enforced.
- Existing admin and delivery workflows remain in place.
- No database migration required; new order fields are optional.


## Phase 36 – Customer Order Tracking Improvements
- Rebuilt `frontend/track-order.html` as a unified customer order-tracking experience for both delivery and pickup orders.
- Added a clear status timeline with timestamps and event notes from the order history.
- Added kitchen preparation estimates and remaining-time display based on the recorded acceptance time.
- Added delivery ETA countdown based on delivery assignment time and estimated delivery minutes.
- Added pickup-ready and collected states for self-pickup orders.
- Delivery map is shown only for delivery orders and displays the most recent shared delivery-partner location.
- Added delivery-partner name and phone display when assigned.
- Live Socket.IO order and location updates are supported, with a 30-second refresh fallback.
- My Orders now links to full order progress for all non-pending-payment orders.
- No database migration required.


## Phase 37 – Customer Experience Improvements
- Added a dedicated customer dashboard at `frontend/customer-dashboard.html`.
- Dashboard shows total orders, active orders, completed orders, estimated paid/completed spend and the four most recent orders.
- Added quick links to restaurants, favourites, notifications and profile.
- Added unread notification count and optional sound alerts; sound preference is stored locally and alerts play only after the user opts in.
- Notifications page now polls for new updates every 30 seconds, shows unread count and supports optional sound alerts.
- Improved quick reorder cart restoration to preserve string item/outlet IDs and validate prices and quantities.
- Added a customer dashboard link to the homepage navigation.
- Uses existing authenticated APIs; no database migration or new backend endpoint required.


## Phase 38 — Customer Loyalty & Rewards

- Customers earn **1 reward point for every ₹10** of the final order total after discounts and delivery fee, rounded down.
- Points are credited only when an order reaches **Delivered** or **Picked up**. Razorpay orders must also be marked paid.
- Awards are idempotent per order; duplicate status updates do not award twice.
- **10 points = ₹1** at checkout. Redemption is capped at 500 points per order and cannot reduce the food subtotal below zero after existing discounts.
- Reward redemption currently supports Cash on Delivery and Pay at Outlet. Online Razorpay redemption is disabled to avoid reserving points while payment is pending.
- Redeemed points are restored if the customer or vendor/admin cancels the order before completion.
- Loyalty tiers use lifetime earned points: Bronze (0–499), Silver (500–1,499), Gold (1,500–2,999), Platinum (3,000+).
- Existing users receive zeroed reward balances automatically through Mongoose schema defaults; no manual migration is required.


## Phase 39 — Customer Address Book & Saved Addresses
- Added up to 10 saved delivery addresses per customer, with Home, Hostel, Work and Other labels.
- Added authenticated customer APIs to list, create, edit, delete and set a default address.
- The first saved address becomes the default automatically; deleting the default promotes another saved address.
- Added a responsive address-book page with validation, edit controls and default-address management.
- Checkout can load and select a saved address, prefill delivery fields, and optionally save a newly entered address after successful order placement.
- Saved addresses are stored on the user document; Mongoose schema defaults support existing accounts without a manual migration.
- Address book is limited to customer accounts and protected by authentication.
