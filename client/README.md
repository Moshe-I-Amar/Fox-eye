# Fox-Eye

A real-time operational tracking and geofencing platform for hierarchical military-style organizations. Users share live GPS location on an interactive map; commanders define Areas of Operations (AOs) as geofenced polygons; the system detects boundary breaches and fires real-time alerts and push notifications.

---

## Features

- **Live map** — Leaflet map with role-colored user markers, online/offline indicators, and AO polygon overlays
- **Real-time engine** — Socket.IO presence tracking, live location updates, and field event broadcasts
- **Field events** — INJURED / AMBUSH / LINK_UP panic reporting with Web Push notifications and in-app alerts
- **Geofencing** — AO breach detection with configurable grace period and cooldown
- **Invite-gated registration** — Admin-issued single-use tokens with pre-assigned role and hierarchy
- **Progressive Web App** — Installable, offline-capable with service worker and background push support
- **Mobile view** — Dedicated `/mobile` route with GPS watcher, Wake Lock, offline event queue, and full-screen map
- **Secure auth** — HttpOnly `SameSite=Strict` session cookie (no localStorage token exposure); CSP enforced server-side
- **Role-based access** — Hierarchical operational roles (HQ → Unit → Company → Team → Squad)
- **Admin panel** — User management, hierarchy CRUD, invite lifecycle, and audit log

---

## Tech Stack

### Client
- **React 18** + Vite 5 + Tailwind CSS 3
- **Leaflet** 1.9 + react-leaflet 4 + leaflet-draw
- **Socket.IO client** — real-time location, presence, and field events
- **Axios** — `withCredentials: true`, automatic 401/403 redirect handling
- **vite-plugin-pwa** (`injectManifest`) — custom service worker with Workbox + Web Push handler
- React Router 6, React Hook Form

### Server
- **Node.js** + Express 4 + MongoDB (Mongoose 8) + Socket.IO 4
- **cookie-parser** — HttpOnly session cookie parsing
- **helmet** — CSP, HSTS, X-Frame-Options, and other security headers
- **web-push** — VAPID Web Push notifications
- JWT (jsonwebtoken + bcryptjs), express-validator, express-rate-limit

---

## Monorepo Structure

```
fox-eye/
├── client/     React 18 + Vite + Tailwind + Leaflet (ESM)
└── server/     Node.js + Express + MongoDB + Socket.IO (CommonJS)
```

---

## Setup

### Prerequisites
- Node.js v18+
- MongoDB instance (local or Atlas)
- VAPID keys for push notifications: `npx web-push generate-vapid-keys`

### Server

```bash
cd server
npm install
cp .env.example .env   # fill in values (see below)
npm run dev            # nodemon on port 5000
```

**Required `.env` values:**
```
PORT=5000
MONGO_URI=mongodb://...
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=1d
CLIENT_ORIGIN=http://localhost:5173          # comma-separated for multiple origins
NODE_ENV=development
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@yourapp.com
```

### Client

```bash
cd client
npm install
cp .env.example .env
# set VITE_API_URL=http://localhost:5000
npm run dev            # Vite on port 5173
```

---

## Authentication Flow

1. User visits `/register?token=<invite>` — token pre-assigns role and hierarchy
2. On login/register the server sets an **HttpOnly; Secure; SameSite=Strict** cookie — no token in the response body
3. All subsequent API requests include the cookie automatically (`withCredentials: true`)
4. Socket.IO reads the session cookie from the WebSocket handshake headers
5. `AuthContext` bootstraps by calling `GET /api/auth/me` — succeeds if the cookie is valid, fails silently if not
6. On logout, `POST /api/auth/logout` clears the cookie server-side before navigation

---

## API Endpoints (summary)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | Login; sets HttpOnly cookie |
| POST | `/api/auth/register` | — | Invite-gated registration; sets cookie |
| POST | `/api/auth/logout` | — | Clears session cookie |
| GET | `/api/auth/me` | cookie | Current user profile |
| GET | `/api/auth/invite/:token` | — | Validate invite token |
| GET | `/api/users/near` | cookie | Nearby users in scope |
| PUT | `/api/users/me/location` | cookie | Update own GPS |
| GET/POST | `/api/events` | cookie | Field events (rate-limited 10/hr POST) |
| PATCH | `/api/events/:id/acknowledge` | cookie | ACK active event |
| PATCH | `/api/events/:id/resolve` | cookie | Resolve event |
| GET | `/api/push/vapid-public-key` | — | VAPID public key |
| POST/DELETE | `/api/push/subscribe` | cookie | Manage push subscription |
| GET/POST/PUT/DELETE | `/api/admin/*` | cookie + admin role | Full admin CRUD |

---

## Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `location:update` | client → server | GPS coordinate update |
| `presence:subscribe` | client → server | Subscribe to online user list |
| `field:event:new` | server → client | New field event broadcast |
| `field:event:acknowledged` | server → client | Event ACK broadcast |
| `field:event:resolved` | server → client | Event RESOLVE broadcast |
| `ao:breach` | server → client | AO boundary breach alert |

Connect with `{ withCredentials: true }` — auth is handled via the session cookie in the WS handshake.

---

## Security

- **HttpOnly cookies** — JWT is inaccessible to JavaScript; eliminates localStorage XSS token theft
- **SameSite=Strict** — CSRF protection without needing a separate CSRF token
- **Content Security Policy** — `script-src 'self'` blocks inline and foreign scripts; Leaflet tile origins explicitly allowlisted
- **SVG injection prevention** — map marker colors validated against a strict hex/rgb allowlist; `data:image/svg+xml` blocked from icon URLs
- **Rate limiting** — 5 req/15min on auth endpoints, 10 req/hr per user on field event POST
- **Invite-gated registration** — no self-signup; all accounts require admin-issued tokens

---

## Browser Support

- Chrome 90+ / Edge 90+
- Firefox 88+
- Safari 14+ (PWA install supported on iOS 16.4+)
