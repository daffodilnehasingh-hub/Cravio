# Cravio backend

This is the Phase 5 authentication API for the Cravio MVP.

## Requirements
- Node.js LTS and npm
- A MongoDB database (MongoDB Atlas or a local MongoDB server)

## Setup
1. Open a terminal in this `backend` folder.
2. Install packages:
   ```bash
   npm install
   ```
3. Copy `.env.example` to a new file named `.env`.
4. In `.env`, replace `MONGODB_URI` with your own MongoDB connection string.
5. Replace `JWT_SECRET` with a long, random secret. Never share or commit `.env`.
6. Start the API:
   ```bash
   npm run dev
   ```

The API starts at `http://localhost:5000` after it connects to MongoDB.
Check `http://localhost:5000/api/health` to confirm the server is running.

## Authentication endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create a customer account |
| POST | `/api/auth/login` | Log in and receive a JWT |
| GET | `/api/auth/me` | Get the logged-in user's profile |
| PATCH | `/api/auth/me` | Update name and phone for the logged-in user |

For `/api/auth/me`, send this request header:
`Authorization: Bearer YOUR_JWT_TOKEN`

Public registration always creates a `customer` account. Admin, vendor and delivery roles must be assigned through a trusted admin process; users cannot grant themselves elevated permissions.

## Frontend
Open the `frontend` folder in VS Code and run `index.html` with Live Server. The auth pages are:
- `login.html`
- `register.html`

The frontend calls `http://localhost:5000/api/auth`. If you use another port or host, update `API_BASE_URL` in `frontend/js/auth.js` and `CORS_ORIGIN` in `.env`.

## Important security notes
- This is a learning MVP, not production-ready authentication.
- The demo frontend stores the JWT in localStorage for simplicity. For production, use Secure, HttpOnly, SameSite cookies and add CSRF protections as appropriate.
- Use HTTPS in deployment, validate all inputs, add account recovery and email verification, and review security settings before launch.
- Student verification is represented only by status fields in this phase. No student ID images or private documents are collected yet.


## Order endpoints (Phase 7)

All order endpoints require `Authorization: Bearer YOUR_JWT_TOKEN`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/orders` | Create an order; server recalculates item prices and totals |
| GET | `/api/orders/my` | List the logged-in customer's orders |
| GET | `/api/orders/:id` | Get one of the logged-in customer's orders |
| GET | `/api/orders/manage` | Admin/vendor order list |
| PATCH | `/api/orders/:id/status` | Admin/vendor updates an order status |

The starter API uses `backend/config/catalogue.js` as a small demo catalogue. Update it to match your menu item IDs and prices before testing orders. Online payment is not integrated in this phase.


## Phase 8 dashboard access
Open `frontend/dashboard.html` with Live Server after logging in as an admin or vendor. Public registration always creates customer accounts. For local development only, an administrator can assign a role in MongoDB Atlas. A vendor should have `role: "vendor"` and a `managedOutletIds` array such as `["2"]`; the vendor must log in again after role changes so the JWT contains the updated outlet assignment. Never expose a public endpoint that lets users change their own role.


## Phase 9: Student ID verification
Add these Cloudinary values to `backend/.env`: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Do not commit `.env`. Student IDs are uploaded as authenticated Cloudinary assets, not public assets.

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/student-verification/submit` | Logged-in customer; multipart field `studentId` |
| GET | `/api/student-verification/me` | Logged-in user |
| GET | `/api/student-verification/pending` | Admin |
| PATCH | `/api/student-verification/:userId/review` | Admin; body `{ "decision": "approved" }` or `{ "decision": "rejected", "reason": "..." }` |

New users are unverified. The backend order controller checks the user's MongoDB `isStudentVerified` value before applying the student discount. The checkbox in the browser cannot grant eligibility.

**Privacy and production note:** Cloudinary authenticated assets and five-minute signed admin download URLs are generated for review. Before real launch, verify Cloudinary delivery/signature settings in your account, add retention/deletion policies for rejected documents, obtain user consent, and review applicable privacy laws. Avoid collecting more student data than needed.
