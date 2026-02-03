# GeoMap

GeoMap is a full-stack web app for real-time, map-based tracking and operational oversight.
It supports user location updates, geofenced areas of operation (AOs), and violation events.
Admins can manage hierarchical units (units, companies, teams, squads) and user access.
The client provides a live map dashboard and admin consoles, while the server exposes REST and Socket.IO APIs.

## Tech Stack

**Client**
- React + React Router
- Vite
- Tailwind CSS
- Leaflet / React-Leaflet (+ draw tools)
- Axios
- Socket.IO Client

**Server**
- Node.js + Express
- MongoDB + Mongoose
- Socket.IO
- JWT (jsonwebtoken)
- express-validator, express-rate-limit, helmet, cors

**Tooling**
- ESLint
- Nodemon

## High-level Architecture

- **Client**: React SPA with route guards and page-level features (Dashboard, Admin, Admin Management).
  Data access is centralized in `src/services` (REST via Axios, realtime via Socket.IO), and shared UI is organized under `src/components`.
- **Server**: Express app with a layered structure:
  - **Routes** map HTTP endpoints to controllers.
  - **Controllers** handle request orchestration and response shaping.
  - **Services** implement domain logic (presence, viewport updates, AO breach detection, admin audit logging).
  - **Models** define MongoDB schemas for users, hierarchy, AOs, and violation events.
  - **Middleware** handles JWT auth, role checks, validation, and error handling.
- **Realtime**: Socket.IO is initialized alongside the HTTP server and authenticated via middleware. The socket service publishes presence and location updates and runs AO breach evaluation.
- **Cross-cutting concerns**: input validation (express-validator), request logging, centralized error handling, security headers (helmet), CORS, and rate limiting are applied in the server app.

## Repository Structure

```
.
|-- client/
|   |-- src/
|   |   |-- components/        # Reusable UI and layout components
|   |   |-- pages/             # Route-level screens (dashboard/admin/auth)
|   |   |-- services/          # REST + Socket.IO clients
|   |   |-- styles/            # Global styles and Tailwind setup
|   |   `-- utils/             # Client helpers
|   |-- index.html
|   `-- vite.config.js
|-- server/
|   |-- src/
|   |   |-- config/            # DB connection and runtime config
|   |   |-- controllers/       # HTTP controller handlers
|   |   |-- middleware/        # Auth, validation, error handling, socket auth
|   |   |-- models/            # Mongoose schemas
|   |   |-- realtime/          # Socket.IO initialization
|   |   |-- routes/            # API route definitions
|   |   |-- scripts/           # Seed and maintenance scripts
|   |   |-- services/          # Domain services (presence, breach, viewport)
|   |   `-- utils/             # Shared helpers and validators
|   `-- src/app.js             # Express app bootstrap
`-- README.md
```

## Setup & Run (Local)

### Prerequisites
- Node.js (LTS recommended)
- MongoDB running locally or reachable from your environment

### Install

```bash
# Client
cd client
npm install

# Server
cd ../server
npm install
```

### Configure Environment

Create local env files from the examples:

```bash
# Client
cp .env.example .env

# Server
cp .env.example .env
```

### Run (Development)

```bash
# Server (from server/)
npm run dev

# Client (from client/)
npm run dev
```

### Run (Production)

```bash
# Server (from server/)
npm start

# Client (from client/)
npm run build
npm run preview
```

## Required Environment Variables

Use the existing `.env.example` files as templates and provide values locally.
Only variable names are listed below (no values).

**Server (`server/.env.example`)**
```
PORT
MONGO_URI
JWT_SECRET
JWT_EXPIRES_IN
CLIENT_ORIGIN
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
- `dev` - Start Vite dev server
- `build` - Production build
- `preview` - Preview production build locally
- `lint` - Run ESLint

**Server** (`server/package.json`)
- `start` - Start server
- `dev` - Start server with Nodemon
- `seed:demo` - Seed demo hierarchy data
- `test` - Run server tests

## Usage (Safe)

- Register or sign in, then open the dashboard to view your current location on the map.
- Use the map controls to update your position and view nearby users.
- Admins can manage users and hierarchy entities (units, companies, teams, squads).
- Admins can create and manage AOs and review violation events.

### API Endpoints (Minimal)

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/users`
- `GET /api/users/near`
- `PUT /api/users/me/location`
- `GET /api/aos`
- `POST /api/aos`
- `GET /api/hierarchy/tree`
- `GET /api/violations`
- `GET /api/admin/hierarchy/tree`

## Security Notes

- Never commit `.env` files or real credentials.
- Rotate secrets immediately if they are exposed.
- Use least-privilege roles for admin operations.
- Enforce HTTPS in production and restrict allowed origins.

## Roadmap / Known Limitations

- Add automated integration tests for realtime events and admin workflows.
- Expand client-side error states and empty-state UX for admin lists.
