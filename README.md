# Fox-Eye (GeoMap)

Fox-Eye is a full-stack real-time operational tracking and geofencing app for hierarchical military-style organizations.
Users share live location on an interactive Leaflet map; admins define Areas of Operations (AOs) as GeoJSON polygons;
the system detects boundary breaches and fires real-time alerts via Socket.IO.

## Tech Stack

**Client**
- React 18 + React Router
- Vite 5
- Tailwind CSS (custom dark/gold theme)
- Leaflet 1.9 / React-Leaflet 4.x (+ draw tools)
- Axios (with JWT interceptors)
- Socket.IO Client

**Server**
- Node.js + Express 4.x (CommonJS)
- MongoDB + Mongoose 8.x
- Socket.IO 4.x
- JWT (jsonwebtoken + bcryptjs)
- express-validator, express-rate-limit, helmet, cors

**Tooling**
- ESLint, Nodemon

## High-level Architecture

**Client** — React SPA with route guards and page-level features (Dashboard, Admin, Admin Management).
Data access is centralized in `src/services` (REST via Axios, realtime via Socket.IO), and shared UI lives under `src/components`.

**Server** — Express app with a clean layered structure:
- **Routes** — map HTTP endpoints to controllers.
- **Controllers** — thin orchestrators: parse request, call services, shape response.
- **Services** — all domain logic lives here (user queries, AO CRUD + Socket emissions, breach detection, presence tracking, audit logging, hierarchy tree building).
- **Models** — Mongoose schemas for users, hierarchy entities, AOs, and violation events.
- **Middleware** — JWT auth (`auth.js`), role/scope guards, centralized authorization predicates (`authorize.js`), validation, and error handling.
- **Utils** — `withTransaction.js` wraps admin writes in MongoDB transactions (with graceful fallback on standalone instances); `asyncHandler` and `AppError` standardize controller error flow.

**Realtime** — Socket.IO is initialized alongside the HTTP server and authenticated via middleware. The socket service publishes scoped presence/location updates and drives AO breach evaluation (APPROACHING_BOUNDARY → BREACH → SUSTAINED_BREACH).

**Cross-cutting** — input validation, centralized error handling, security headers (helmet), CORS (multi-origin), and rate limiting are applied globally in the Express bootstrap.

## Repository Structure

```
.
├── client/
│   └── src/
│       ├── components/        # Reusable UI (Button, Card, Input, Modal) and layout (Navbar, route guards)
│       ├── pages/             # Dashboard, Admin, AdminManagement, Login, Register
│       ├── services/          # REST API clients (api.js, authApi, usersApi, aoApi, adminApi, violationsApi) + socketService
│       ├── styles/            # Global styles and Tailwind setup
│       └── utils/             # Client helpers (location validation)
├── server/
│   └── src/
│       ├── config/            # DB connection (with retry logic)
│       ├── controllers/       # Thin HTTP handlers (auth, users, AOs, hierarchy, violations, admin)
│       ├── middleware/        # auth.js, authorize.js, socketAuth, errorHandler, validators
│       ├── models/            # User, AO, ViolationEvent, Company, Unit, Team, Squad, AdminAuditLog
│       ├── realtime/          # Socket.IO initialization (socket.js, getIO/getSocketService)
│       ├── routes/            # Route definitions
│       ├── scripts/           # seedDemoHierarchy.js
│       ├── services/          # userService, aoService, violationService, hierarchyService,
│       │                      #   breachService, locationService, presenceService,
│       │                      #   socketService, adminAuditService, scopeResolver
│       └── utils/             # withTransaction, asyncHandler, AppError, presenceManager,
│                              #   aoDetection, validators, roles, filterByScope
└── README.md
```

## Setup & Run (Local)

### Prerequisites
- Node.js (LTS recommended)
- MongoDB running locally or accessible from your environment

### Install

```bash
cd client && npm install
cd ../server && npm install
```

### Configure Environment

```bash
# In client/
cp .env.example .env

# In server/
cp .env.example .env
```

### Run (Development)

```bash
# Server (from server/)
npm run dev        # nodemon on port 5000

# Client (from client/)
npm run dev        # Vite on port 5173
```

### Run (Production)

```bash
# Server
npm start

# Client
npm run build && npm run preview
```

## Required Environment Variables

**Server (`server/.env.example`)**
```
PORT
MONGO_URI
JWT_SECRET
JWT_EXPIRES_IN
CLIENT_ORIGIN                        # comma-separated for multiple origins
NODE_ENV
DB_CONNECT_RETRIES
DB_CONNECT_RETRY_DELAY_MS
AO_BREACH_GPS_TOLERANCE_METERS
AO_BREACH_GRACE_MS
AO_BREACH_COOLDOWN_MS
SOCKET_LOCATION_WINDOW_MS
SOCKET_LOCATION_MAX_PER_WINDOW
SOCKET_LOCATION_MIN_INTERVAL_MS
SOCKET_VIEWPORT_WINDOW_MS
SOCKET_VIEWPORT_MAX_PER_WINDOW
```

**Client (`client/.env.example`)**
```
VITE_API_URL
```

## Scripts

**Client** (`client/package.json`)
- `dev` — Vite dev server
- `build` — Production build
- `preview` — Preview production build
- `lint` — ESLint

**Server** (`server/package.json`)
- `start` — Start server
- `dev` — Nodemon dev server
- `seed:demo` — Seed demo hierarchy data
- `test` — Run server tests

## Domain Model

| Model | Key Fields |
|-------|-----------|
| `User` | email, role (admin/user), operationalRole (5-tier), location (GeoJSON Point + 2dsphere index), unit/company/team/squadId, online, lastSeen |
| `AO` | GeoJSON Polygon, companyId, active, style (color, pattern, icon) |
| `ViolationEvent` | type (APPROACHING_BOUNDARY \| BREACH \| SUSTAINED_BREACH), userId, aoId, coordinates, occurredAt |
| `Company/Unit/Team/Squad` | Hierarchical org entities with parent refs |
| `AdminAuditLog` | action, actorId, subject, companyId, timestamp |

**Operational role hierarchy (descending authority):**
`HQ` > `UNIT_COMMANDER` > `COMPANY_COMMANDER` > `TEAM_LEADER` > `SQUAD_COMMANDER`

## API Endpoints

```
GET  /api/health
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me

GET  /api/users
GET  /api/users/near
PUT  /api/users/me/location

GET  /api/aos
POST /api/aos
PUT  /api/aos/:id
DELETE /api/aos/:id

GET  /api/hierarchy/tree
GET  /api/violations

GET  /api/admin/hierarchy/tree
POST /api/admin/companies
POST /api/admin/units
POST /api/admin/teams
POST /api/admin/squads
POST /api/admin/users
PUT  /api/admin/users/:id
DELETE /api/admin/...
```

## Security Notes

- Never commit `.env` files or real credentials.
- Rotate secrets immediately if exposed.
- Use least-privilege roles for admin operations.
- Enforce HTTPS in production and restrict `CLIENT_ORIGIN` to known domains.

## Known Limitations

- Limited automated integration tests for realtime events and admin workflows.
- Client-side error states and empty-state UX for admin lists need expansion.
