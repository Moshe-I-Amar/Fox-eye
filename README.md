# Fox-Eye

Fox-Eye is a full-stack real-time operational tracking and geofencing app for hierarchical military-style organizations.
Users share live GPS location on an interactive Leaflet map; commanders define Areas of Operations (AOs) as GeoJSON polygons; the system detects boundary breaches, broadcasts field events (INJURED / AMBUSH / LINK UP), and delivers native Web Push notifications — all in real time via Socket.IO.

Installable as a PWA on mobile and desktop.

---

## Features

| Feature | Description |
|---------|-------------|
| **Live location tracking** | GPS watcher broadcasts `[lng, lat]` to all in-scope users via socket |
| **AO management** | Admins draw GeoJSON polygons on the map; breach detection fires APPROACHING → BREACH → SUSTAINED_BREACH alerts |
| **Field events** | Panic buttons (INJURED / AMBUSH / LINK UP) report incidents with GPS coords; commanders ACK and RESOLVE |
| **Field event map markers** | INJURED/AMBUSH/LINK UP pins appear on the Dashboard map in real time; active pins pulse |
| **In-app alert banner** | Incoming `field:event:new` fires an AlertBanner; INJURED/AMBUSH stay until dismissed, LINK UP auto-dismisses after 8 s; one-click ACK from the banner |
| **Web Push notifications** | VAPID push sent to all subscribed in-scope users when a field event is created; INJURED/AMBUSH require interaction, LINK UP auto-dismisses |
| **Invite-only registration** | Commanders generate single-use tokens that pre-assign role + hierarchy |
| **PWA / offline support** | Service worker (Workbox `injectManifest`) caches API + map tiles; field events queue to localStorage while offline and flush on reconnect |
| **Mobile field view** | Dedicated `/mobile` route with GPS watcher, Wake Lock, offline event queue, and tactile panic buttons |
| **Scope-based access** | Every API query and socket broadcast is filtered to what the requesting user's hierarchy rank can see |
| **Admin audit log** | All sensitive admin writes (user/hierarchy/invite changes) are logged with before/after snapshots |

---

## Tech Stack

**Client**
- React 18 + React Router 6
- Vite 5 + **vite-plugin-pwa** (`injectManifest` strategy, custom `src/sw.js`)
- Tailwind CSS 3 (custom dark/gold theme)
- Leaflet 1.9 / React-Leaflet 4.x (+ leaflet-draw)
- Axios with JWT interceptors
- Socket.IO Client 4.x
- Workbox (precache + runtime caching)

**Server**
- Node.js + Express 4.x (CommonJS)
- MongoDB + Mongoose 8.x
- Socket.IO 4.x
- JWT (jsonwebtoken + bcryptjs)
- **web-push** (VAPID Web Push)
- express-validator, express-rate-limit, helmet, cors

---

## Repository Structure

```
fox-eye/
├── client/
│   └── src/
│       ├── components/
│       │   ├── layout/        # Navbar, RouteGuard
│       │   └── ui/            # Button, Card, Input, Modal, AlertBanner, Badge, NotificationPrompt
│       ├── config/            # constants.js
│       ├── context/           # AuthContext (AuthProvider + useAuth hook)
│       ├── hooks/             # useAOs, useViolations, useFieldEvents, useOfflineQueue, useNotifications
│       ├── pages/
│       │   ├── Dashboard.jsx  # Main map, AO management, field event markers + sidebar, alert banner
│       │   ├── Admin.jsx      # Violations list
│       │   ├── AdminManagement.jsx
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   └── mobile/        # MobileFieldView, MobileLayout, PanicPanel, MobileFieldMap, MobileEventFeed
│       ├── services/          # api.js, authApi, usersApi, aoApi, adminApi, eventApi, pushService, socketService
│       ├── styles/            # globals.css
│       ├── sw.js              # Custom service worker (Workbox + Web Push handler)
│       └── utils/             # location.js
├── server/
│   └── src/
│       ├── config/            # db.js (MongoDB with retry)
│       ├── controllers/       # auth, users, aos, hierarchy, violations, admin, event, push
│       ├── middleware/        # auth.js, authorize.js, errorHandler.js, validators
│       ├── models/            # User, AO, ViolationEvent, FieldEvent, PushSubscription,
│       │                      #   Company, Unit, Team, Squad, InviteToken, AdminAuditLog
│       ├── routes/            # Route definitions
│       ├── scripts/           # seedDemoHierarchy.js
│       ├── services/          # userService, aoService, violationService, hierarchyService,
│       │                      #   breachService, locationService, presenceService,
│       │                      #   socketService, adminAuditService, scopeResolver,
│       │                      #   fieldEventService, pushService
│       └── utils/             # withTransaction, asyncHandler, AppError, roles, filterByScope, validators
└── README.md
```

---

## Setup & Run (Local)

### Prerequisites
- Node.js LTS
- MongoDB running locally or an Atlas URI

### Install

```bash
cd client && npm install
cd ../server && npm install
```

### Configure Environment

```bash
# client/
cp .env.example .env          # set VITE_API_URL

# server/
cp .env.example .env          # fill all vars (see below)
```

#### Generate VAPID keys (required for Web Push)

```bash
npx web-push generate-vapid-keys
# paste output into server/.env
```

### Run (Development)

```bash
# Server (port 5000)
cd server && npm run dev

# Client (port 5173)
cd client && npm run dev
```

### Run (Production)

```bash
cd server && npm start
cd client && npm run build
```

---

## Environment Variables

### Server (`server/.env`)

```
PORT=5000
MONGO_URI=                        # MongoDB connection string
JWT_SECRET=
JWT_EXPIRES_IN=1d
CLIENT_ORIGIN=                    # comma-separated allowed origins
NODE_ENV=development

# MongoDB retry
DB_CONNECT_RETRIES=5
DB_CONNECT_RETRY_DELAY_MS=2000

# AO breach detection
AO_BREACH_GPS_TOLERANCE_METERS=15
AO_BREACH_GRACE_MS=10000
AO_BREACH_COOLDOWN_MS=60000

# Socket rate limiting
SOCKET_LOCATION_WINDOW_MS=10000
SOCKET_LOCATION_MAX_PER_WINDOW=25
SOCKET_LOCATION_MIN_INTERVAL_MS=400
SOCKET_VIEWPORT_WINDOW_MS=10000
SOCKET_VIEWPORT_MAX_PER_WINDOW=40

# Web Push (VAPID) — generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@your-domain.com
```

### Client (`client/.env`)

```
VITE_API_URL=http://localhost:5000
```

---

## Registration & Access Control

Fox-Eye uses **invite-only registration**. Open self-registration is disabled.

### Flow

1. Commander opens **Admin Management → Invites → Generate Invite**
2. Invite binds a role, hierarchy assignment, and expiry (1–30 days, default 7)
3. Commander shares the generated URL (`/register?token=<hex>`)
4. Recruit visits the link — hierarchy and role are pre-filled and locked
5. Recruit supplies name, email, password only
6. Token is consumed atomically in a MongoDB transaction (single-use)

### Invite rules

| Rule | Detail |
|------|--------|
| Who can invite | `HQ`, `UNIT_COMMANDER`, `COMPANY_COMMANDER` only |
| Rank constraint | Inviter's rank must be strictly higher than the target role |
| Admin invites | `HQ` only |
| Company scope | `COMPANY_COMMANDER` can only invite into their own company |
| Revocation | Any invite can be revoked before use |

### Account status lifecycle

| Status | Meaning |
|--------|---------|
| `active` | Normal access |
| `pending` | Awaiting activation — login returns `AUTH_PENDING` (403) |
| `rejected` | Access denied — login returns `AUTH_REJECTED` (403) |
| `active=false` | Deactivated — login returns `AUTH_INACTIVE` (403) |

---

## Domain Model

| Model | Key Fields |
|-------|-----------|
| `User` | email, role (`admin`/`user`), operationalRole (5-tier), status, location (GeoJSON Point, 2dsphere), unit/company/team/squadId, online, lastSeen, active |
| `InviteToken` | token (hex, unique), createdBy, expiresAt, usedAt/usedBy, assignedRole, assignedOperationalRole, hierarchy IDs |
| `AO` | name, polygon (GeoJSON), companyId, active, style (color, icon, pattern) |
| `ViolationEvent` | type (`APPROACHING_BOUNDARY`/`BREACH`/`SUSTAINED_BREACH`), userId, aoId, coordinates, occurredAt |
| `FieldEvent` | eventType (`INJURED`/`AMBUSH`/`LINK_UP`), senderId, coordinates (GeoJSON Point, 2dsphere), status (`ACTIVE`→`ACKNOWLEDGED`→`RESOLVED`), acknowledgedBy/At, resolvedBy/At, denormalized hierarchy IDs |
| `PushSubscription` | userId, endpoint (unique), keys (p256dh, auth), denormalized role + hierarchy for scope-based push targeting |
| `AdminAuditLog` | action string, actorUserId, targetType, targetId, before/after snapshots |
| `Company/Unit/Team/Squad` | name, parentId, commanderId, active |

**Operational role hierarchy (descending authority):**
`HQ` > `UNIT_COMMANDER` > `COMPANY_COMMANDER` > `TEAM_COMMANDER` > `SQUAD_COMMANDER`

**Coordinate convention:** MongoDB / GeoJSON = `[lng, lat]` · Leaflet = `[lat, lng]`

---

## API Endpoints

```
Auth (rate limited: 5/15 min for login/register)
  POST   /api/auth/register              # invite-gated; inviteToken required in body
  POST   /api/auth/login
  GET    /api/auth/me
  GET    /api/auth/invite/:token         # validate invite (public)

Users
  GET    /api/users                      # admin only
  GET    /api/users/near
  GET    /api/users/:id
  PUT    /api/users/me/location

Hierarchy (read-only, public)
  GET    /api/hierarchy/tree
  GET    /api/hierarchy/units|companies|teams|squads

Areas of Operation
  GET    /api/aos
  POST   /api/aos
  PUT    /api/aos/:id
  PATCH  /api/aos/:id/active
  DELETE /api/aos/:id

Violations
  GET    /api/violations
  GET    /api/violations/:id

Field Events (POST rate limited: 10/hr per user)
  GET    /api/events                     # ?status=&eventType=&page=&limit=
  POST   /api/events                     # report INJURED/AMBUSH/LINK_UP; fires socket + Web Push
  PATCH  /api/events/:id/acknowledge
  PATCH  /api/events/:id/resolve

Web Push
  GET    /api/push/vapid-public-key      # public — no auth
  POST   /api/push/subscribe             # save subscription for current user
  DELETE /api/push/subscribe             # remove subscription; body: { endpoint }

Admin (auth + admin role + HQ/UC/CC operationalRole)
  GET    /api/admin/hierarchy/tree
  POST   /api/admin/companies|teams|squads
  PUT    /api/admin/companies|teams|squads/:id
  DELETE /api/admin/companies|teams|squads/:id
  POST   /api/admin/users
  PUT    /api/admin/users/:id
  PATCH  /api/admin/users/:id/active
  PATCH  /api/admin/users/:id/roles
  POST   /api/admin/invites
  GET    /api/admin/invites?status=active|used|expired
  DELETE /api/admin/invites/:id

System
  GET    /api/health
```

---

## Socket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `location:update` | server → clients | `{ userId, coordinates, timestamp }` |
| `location:request` | client → server | request nearby users |
| `location:response` | server → client | `{ users }` |
| `presence:update` | server → clients | `{ userId, online, lastSeen }` |
| `presence:subscribe` | client → server | subscribe to presence feed |
| `viewport:subscribe` | client → server | subscribe to viewport bounds |
| `field:event:new` | server → in-scope | `{ event, timestamp }` — `event` includes `senderName` |
| `field:event:acknowledged` | server → in-scope | `{ event, timestamp }` |
| `field:event:resolved` | server → in-scope | `{ event, timestamp }` |
| `ao:created` / `ao:updated` / `ao:deleted` | server → in-scope | AO change broadcasts |

---

## Field Events

Field events are geolocated incident reports sent from the mobile panic panel or any authenticated client.

### Event types

| Type | Severity | Notification |
|------|----------|-------------|
| `INJURED` | Critical | Push stays until dismissed; in-app banner stays until dismissed |
| `AMBUSH` | Critical | Push stays until dismissed; in-app banner stays until dismissed |
| `LINK_UP` | Informational | Push auto-dismisses; in-app banner auto-dismisses after 8 s |

### Lifecycle

```
ACTIVE  ──ACK──▶  ACKNOWLEDGED  ──RESOLVE──▶  RESOLVED
   └────────────────RESOLVE─────────────────▶  RESOLVED
```

### Anti-spoofing

The server validates each event against the sender's last known position:
- **Velocity check** — rejects events where the implied movement speed is physically impossible
- **Timestamp skew** — rejects `clientTimestamp` more than ±2 minutes from server time

---

## PWA & Offline

- Installable on Android, iOS, and desktop via the browser install prompt
- Service worker (`src/sw.js`, `injectManifest` mode) caches:
  - All static assets (precache)
  - API responses: network-first, 10 s timeout, then cache fallback
  - Map tiles: cache-first, 500 entries, 7-day expiry
- **Offline field events** — the mobile panic panel queues events to `localStorage` while offline; they are flushed in order when the connection is restored
- Wake Lock API keeps the mobile screen on during active sessions

---

## Security Notes

- Never commit `.env` files or real credentials
- Rotate `JWT_SECRET` and VAPID keys immediately if exposed
- `CLIENT_ORIGIN` should be restricted to known domains in production
- Field event POST endpoint is rate-limited to 10 requests/hour per user
- Auth endpoints are rate-limited to 5 requests/15 min

---

## Scripts

**Client** (`client/package.json`)

| Script | Description |
|--------|-------------|
| `dev` | Vite dev server on port 5173 |
| `build` | Production build (includes PWA service worker) |
| `preview` | Preview production build |
| `lint` | ESLint |

**Server** (`server/package.json`)

| Script | Description |
|--------|-------------|
| `start` | Start server |
| `dev` | Nodemon dev server on port 5000 |
| `seed:demo` | Seed demo hierarchy and users |
| `test` | Run server tests |
