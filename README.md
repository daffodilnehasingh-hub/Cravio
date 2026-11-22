# Cravio

> **Modern Food Delivery & Campus Canteen Platform**  
> Serving Kota, Rajasthan — tailored for students, local foodies, restaurants, and campus canteens.

---

## Live Application

Explore the fully deployed, interactive web application:  
**[https://cravio-mu.vercel.app/](https://cravio-mu.vercel.app/)**

* The application runs with client-side state management, responsive UI, dark/light mode toggle, and rich demo fallbacks for fast, zero-configuration exploration.
* Fully deployed on Vercel with serverless API routes (`/api/*`), paired with MongoDB Atlas, Cloudinary-powered student verification uploads, Razorpay checkout, and administrative controls.
* For local development or persistent cloud deployments, the Node.js + Express standalone server (`backend/server.js`) provides live Socket.IO delivery tracking rooms with periodic polling fallbacks in serverless environments.

---

## Features Overview

### 1. Customer Experience
* **Restaurant & Campus Canteen Discovery**: Dedicated directories for popular city outlets and on-campus canteens (`restaurants.html`).
* **Smart Search & Filters**: Filter by Veg, Non-Veg, Vegan, Snacks, Drinks, Street Food, Delivery vs. Pickup, and minimum rating.
* **Dynamic Menu & Cart Drawer**: Interactive item counters, custom instructions, real-time bill calculations, and responsive cart drawer (`menu.html`).
* **Global Header Cart**: Shared cart widget and modal across pages (`index.html`, `restaurants.html`) with live item counts and instant checkout access (`cart-widget.js`).
* **Universal Dark/Light Theme**: Persistent theme preferences across all application pages (`theme.js`).
* **Flexible Checkout Options**: Choose between Doorstep Delivery and Self-Pickup (`checkout.html`).
* **Student Verification & Discounts**: Upload student ID cards (Cloudinary secure storage) to unlock verified student discount benefits (`student-verification.html`).
* **Customer Loyalty & Rewards**: Earn 1 point per ₹10 spent; redeem points (10 points = ₹1) directly at checkout across 4 tiers (Bronze, Silver, Gold, Platinum).
* **Saved Address Book**: Store up to 10 delivery locations (Home, Hostel, Work, Other) with default address tagging (`address-book.html`).
* **Live Order Tracking**: Real-time status progress, preparation countdown timers, delivery partner assignment, and live maps (`track-order.html`).
* **Customer Dashboard**: Overview of recent orders, active orders, total spend, favorites, and profile status (`customer-dashboard.html`).
* **In-App Notifications & Sound Alerts**: Real-time updates on order stage, dispatch, and support ticket replies (`notifications.html`).
* **Ratings & Reviews**: Verified order ratings and comments (`reviews.html`).
* **Digital Receipts & Reorder**: Instant digital receipts (`receipt.html`) and single-click cart reorders.

### 2. Vendor & Kitchen Management
* **Kitchen Display System (KDS)**: Oldest-first order queue with stage filters (Placed, Accepted, Preparing, Ready) (`vendor-kitchen.html`).
* **Preparation Time Controls**: Set prep estimates (1–240 minutes) with real-time target countdowns and overdue indicators.
* **Menu & Inventory Control**: Toggle item availability, update prices, add new items, and execute bulk percentage price adjustments (`outlet-management.html`, `inventory.html`).
* **Vendor Dashboard**: Outlet analytics, daily volume, revenue metrics, and active order management (`vendor-dashboard.html`).
* **Orders Dashboard**: Manage incoming orders, review items, and update progression stages (`dashboard.html`).

### 3. Delivery Partner Operations
* **Delivery Dashboard**: View active assigned deliveries, pickup details, drop-off directions, and customer contact information (`delivery-dashboard.html`).
* **Delivery Management**: Assign drivers, update delivery stages, and broadcast live coordinates (`delivery-management.html`).

### 4. Admin Control Center
* **Unified Control Hub**: Centralized administration for outlets, users, orders, and platform settings (`admin-control.html`).
* **Outlet Management**: Create, verify, and modify outlet profiles and menus (`admin-outlets.html`).
* **Customer Management**: View registered customers, account status, loyalty points, order history, and role assignments (`admin-customers.html`).
* **Student Verifications Review**: Inspect uploaded college IDs and approve/reject student status (`admin-verifications.html`).
* **Coupon & Promotions Engine**: Create percentage/fixed coupons with minimum basket size, usage caps, and expiry dates (`admin-coupons.html`).
* **Refund Management**: Review customer refund requests and process status updates (`admin-refunds.html`).
* **Support Ticket Desk**: Manage support inquiries and communicate via ticket threads (`admin-support.html`).
* **Revenue & Sales Analytics**: Financial reports, order distribution, and performance metrics (`admin-analytics.html`).

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Semantic HTML5, Modular CSS3 (Unified Design System, Dark/Light Themes), Vanilla JavaScript (ES6+), Lucide SVG Icons |
| **Backend** | Node.js, Express.js REST API (Modular architecture supporting both Standalone Server & Serverless Functions) |
| **Database** | MongoDB with Mongoose ODM (MongoDB Atlas / local MongoDB) |
| **Real-time** | Socket.IO (Order rooms, delivery tracking) with automatic 30s polling fallback for serverless environments |
| **File Storage** | Cloudinary (Authenticated student ID verification uploads) |
| **Payments** | Razorpay SDK & HMAC-SHA256 Webhook Verification |
| **Authentication** | JWT (JSON Web Tokens), bcryptjs password hashing, instant verified registration & role-based landing redirection |
| **Email Service** | Nodemailer with account recovery & password reset workflows (optional SMTP configuration) |
| **Deployment** | Vercel (Frontend & Serverless API via `api/index.js`), Node.js standalone server (`backend/server.js`) |

---

## Repository Structure

```
Cravio/
├── api/                          # Vercel serverless function entrypoints
│   └── index.js                  # Serverless request handler wrapping Express API
├── frontend/                     # Frontend client (deployed on Vercel)
│   ├── css/                      # Stylesheets and unified design system
│   │   ├── design-system.css     # CSS variables, tokens, and dark theme
│   │   ├── styles.css            # Global layout and homepage styling
│   │   └── ...                   # Page-specific stylesheets
│   ├── js/                       # Modular client scripts
│   │   ├── app.js                # Core homepage logic and demo data
│   │   ├── auth.js               # Client auth management, session checks, and role redirects
│   │   ├── cart-widget.js        # Global header cart drawer & modal
│   │   ├── icons.js              # Inline SVG icon generator
│   │   ├── theme.js              # Universal dark/light theme manager
│   │   └── ...                   # Page-specific controllers
│   ├── index.html                # Homepage
│   ├── restaurants.html          # Restaurant and campus canteen directory
│   ├── menu.html                 # Outlet menu and cart drawer
│   ├── checkout.html             # Multi-step checkout
│   ├── track-order.html          # Real-time order tracking
│   ├── customer-dashboard.html   # Customer overview
│   ├── dashboard.html            # Orders dashboard for admin and vendor
│   ├── vendor-kitchen.html       # Vendor kitchen display system
│   ├── admin-control.html        # Admin control panel
│   └── ...                       # 32 total application pages
├── backend/                      # Node.js + Express API server
│   ├── app.js                    # Express app configuration & middleware pipeline
│   ├── server.js                 # Standalone API & Socket.IO server entrypoint
│   ├── config/                   # Database, Cloudinary, and catalogue configs
│   ├── controllers/              # Auth, order, outlet, coupon, and admin controllers
│   ├── middleware/               # JWT authentication, role guards, error handlers
│   ├── models/                   # Mongoose schemas (User, Order, Outlet, Coupon, etc.)
│   ├── routes/                   # Express REST route definitions
│   ├── scripts/                  # Data seeds and icon builders
│   ├── services/                 # Payment reconciliation and background jobs
│   ├── utils/                    # Email service, notification helpers, credentials
│   └── package.json              # Backend dependencies
├── tools/                        # Development and build utilities
│   ├── serve-frontend.js         # Zero-dependency static dev server (port 5500)
│   └── inject-design-system.js   # Design system injector utility
├── vercel.json                   # Vercel deployment configuration
├── .vercelignore                 # Vercel deployment exclusions
├── package.json                  # Root dependencies for Vercel deployment
├── .gitignore                    # Clean git ignore configuration
└── README.md                     # Documentation and architecture guide
```

---

## Getting Started

### 1. Running the Frontend Locally

You can run the frontend using the included zero-dependency dev server, VS Code Live Server, or any static server:

**Option A: Using the built-in dev server (Recommended)**
```bash
# From the repository root
node tools/serve-frontend.js
```
The application will launch at `http://localhost:5500/` (matching backend CORS defaults).

**Option B: Using VS Code Live Server**
1. Open this repository in VS Code.
2. Right-click on `frontend/index.html` and select **"Open with Live Server"**.
3. The application will launch at `http://127.0.0.1:5500/frontend/index.html`.

**Option C: Using Python or Node static server**
```bash
# Using npx serve
npx serve frontend -p 5500

# OR using Python
cd frontend
python -m http.server 5500
```

---

### 2. Setting Up the Backend API

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Create a `.env` file in `backend/` based on `backend/.env.example`:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/cravio?retryWrites=true&w=majority
   JWT_SECRET=your_jwt_secret_key
   CORS_ORIGIN=http://127.0.0.1:5500,http://localhost:5500,https://cravio-mu.vercel.app

   # Optional integrations
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   RAZORPAY_KEY_ID=your_razorpay_key
   RAZORPAY_KEY_SECRET=your_razorpay_secret
   RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

   # Optional SMTP credentials (for password resets and OTPs)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   EMAIL_FROM=Cravio <your_email@gmail.com>
   ```
4. Seed the initial database outlets and menus:
   ```bash
   node scripts/seedOutlets.js
   ```
5. Start the backend development server:
   ```bash
   npm run dev
   ```
   The API will be available at `http://localhost:5000/api` with health check at `http://localhost:5000/api/health`.

---

## Application Pages Directory

| Page | Path | Description |
|---|---|---|
| **Home** | `frontend/index.html` | Hero, dish search, categories, top outlets, student highlights |
| **Restaurants** | `frontend/restaurants.html` | Restaurant and canteen listings with search & rating filters |
| **Outlet Menu** | `frontend/menu.html` | Interactive outlet menu, dish customizations, cart drawer |
| **Checkout** | `frontend/checkout.html` | Delivery/pickup mode, address selector, coupons, reward points, Razorpay |
| **Order Tracking** | `frontend/track-order.html` | Real-time tracking timeline, prep timer, driver location map |
| **Order History** | `frontend/orders.html` | Past orders, item details, reorder actions, receipt links |
| **Receipt** | `frontend/receipt.html` | Printable digital invoice with itemized tax and discounts |
| **Customer Dashboard** | `frontend/customer-dashboard.html` | Customer metrics, recent orders, reward tier status |
| **Orders Dashboard** | `frontend/dashboard.html` | Admin and vendor order management and status progression |
| **Address Book** | `frontend/address-book.html` | Manage up to 10 delivery addresses with labels and defaults |
| **Student Verification** | `frontend/student-verification.html` | Submit college ID for student discount privileges |
| **Customer Favorites** | `frontend/favorites.html` | Bookmarked restaurants and canteens |
| **Notifications** | `frontend/notifications.html` | In-app alerts, order updates, and sound toggles |
| **User Profile** | `frontend/profile.html` | Account settings, personal info, student verification status |
| **Reviews & Ratings** | `frontend/reviews.html` | Submit and browse customer ratings and comments |
| **Support Desk** | `frontend/support.html` | Customer ticket creation and live chat threads |
| **Authentication** | `frontend/login.html` & `register.html` | Secure customer and partner login, instant verified registration, password reset |
| **Vendor Kitchen (KDS)** | `frontend/vendor-kitchen.html` | Kitchen display system for order queue and preparation tracking |
| **Vendor Dashboard** | `frontend/vendor-dashboard.html` | Outlet performance, incoming orders, and menu toggle |
| **Outlet Management** | `frontend/outlet-management.html` | Add/edit dishes, update pricing, bulk percentage adjustments |
| **Inventory Control** | `frontend/inventory.html` | Stock level monitoring and item availability toggle |
| **Delivery Dashboard** | `frontend/delivery-dashboard.html` | Driver active pickup and delivery assignments |
| **Delivery Management** | `frontend/delivery-management.html` | Driver dispatch, route status, and location broadcaster |
| **Admin Control** | `frontend/admin-control.html` | Central administration console |
| **Admin Outlets** | `frontend/admin-outlets.html` | Platform-wide outlet verification and approvals |
| **Admin Customers** | `frontend/admin-customers.html` | User management, spend metrics, and role assignments |
| **Admin Verifications**| `frontend/admin-verifications.html` | Review submitted student IDs and grant student status |
| **Admin Coupons** | `frontend/admin-coupons.html` | Create and manage discount codes |
| **Admin Refunds** | `frontend/admin-refunds.html` | Review and process customer refund requests |
| **Admin Support** | `frontend/admin-support.html` | Platform customer support desk |
| **Admin Analytics** | `frontend/admin-analytics.html` | Revenue, order frequency, and platform statistics |

---

## Development Phases (Phases 1 – 39)

<details>
<summary><strong>Click to view full development history</strong></summary>

* **Phases 1–4**: Core MVP UI, categories, restaurants directory, menu, cart, and multi-step checkout.
* **Phase 5**: Node.js + Express backend with MongoDB and JWT authentication.
* **Phase 6**: Profile and account management with token-based authorization.
* **Phase 7**: Server-side MongoDB order creation and price validation.
* **Phase 8**: Order tracking timeline and outlet management dashboard.
* **Phase 9**: Student verification with Cloudinary authenticated ID uploads and admin review.
* **Phase 10**: Socket.IO real-time delivery tracking rooms.
* **Phase 11**: Verified ratings, customer reviews, and saved favorites.
* **Phase 12**: Order cancellation, single-click reorders, and digital receipts.
* **Phase 13**: Customer support ticketing system with threaded replies.
* **Phase 14**: In-app notifications with read status and unread counters.
* **Phase 15**: Admin coupon engine (percentage/fixed discounts, usage caps, expiry).
* **Phase 16**: Dynamic database-driven outlets and menu management endpoints.
* **Phase 17**: Dynamic customer menu integration with fallback support.
* **Phase 18**: Razorpay online payments with HMAC-SHA256 verification.
* **Phase 19**: Email verification and password reset workflows (with streamlined instant registration).
* **Phase 20**: Secure forgot password and password reset workflows.
* **Phase 21**: Admin and vendor revenue and performance analytics dashboard.
* **Phase 22**: Inventory and real-time stock management.
* **Phase 23**: Delivery partner management and dispatch.
* **Phase 24**: Advanced multi-attribute search, sorting, and dietary filters.
* **Phase 25**: Personalized homepage dish recommendations based on order history.
* **Phase 26**: Razorpay payment verification hardening.
* **Phase 27**: Razorpay webhook handlers and asynchronous payment verification.
* **Phase 28**: Pending payment expiry and auto-reconciliation jobs.
* **Phase 29**: Customer refund requests and admin resolution processing.
* **Phase 30**: Admin Control Center consolidation.
* **Phase 31**: Admin customer management with role permissions.
* **Phase 32**: Advanced outlet management with operational hours and delivery fees.
* **Phase 33**: Vendor dashboard enhancements.
* **Phase 34**: Vendor menu management with bulk percentage price adjustments (-90% to +200%).
* **Phase 35**: Advanced Vendor Order & Kitchen Display System (`vendor-kitchen.html`).
* **Phase 36**: Customer Order Tracking overhaul with status timeline and live ETA.
* **Phase 37**: Dedicated Customer Dashboard (`customer-dashboard.html`) and sound alerts.
* **Phase 38**: Customer Loyalty & Rewards program (1 pt per ₹10, tiers, checkout redemption).
* **Phase 39**: Customer Address Book (up to 10 saved addresses with labels and defaults).
* **Production Hardening**: Instant OTP-free registration with automatic sign-in, role-based landing redirection, Vercel serverless integration (`api/index.js`), cross-page cart widget (`cart-widget.js`), universal theme toggle (`theme.js`), and removal of deprecated configuration/scripts.

</details>

---

## Security & Best Practices

* **Zero Plaintext Secrets**: All sensitive secrets (`JWT_SECRET`, database passwords, Razorpay keys, Cloudinary credentials) are strictly kept in environment variables (`.env`).
* **Tamper-Proof Checkout**: Order prices and discounts are verified server-side using MongoDB menu records and secure calculation logic.
* **Role-Based Access Control**: Strict middleware guards enforce role authorization across customer, vendor, delivery partner, and administrative accounts.
* **Rate Limiting & Security Headers**: Backend utilizes `helmet` and `express-rate-limit` to protect API and auth endpoints.
* **Graceful Degradation**: Frontend functions smoothly as an interactive demo with rich fallbacks and polling even without an active backend connection.

---

## License

This project is open-source and available under the MIT License.
