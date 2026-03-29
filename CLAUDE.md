# Fox-Eye — Claude Code Context

## What This App Does
Fox-Eye (GeoMap) is a real-time operational tracking and geofencing app for hierarchical military-style organizations. Users share live location on a Leaflet map; admins define Areas of Operations (AOs) as GeoJSON polygons; the system detects breaches and fires real-time alerts.

## Monorepo Structure
```
fox-eye/
├── client/     React 18 + Vite + Tailwind + Leaflet (ESM)
├── server/     Node.js + Express + MongoDB + Socket.IO (CommonJS)
└── .claude/    Claude Code config and commands
```

---

## Server (server/src/)

### Stack
- Node.js, **CommonJS** (`require`/`module.exports` — never use `import/export`)
- Express 4.x, Mongoose 8.x, Socket.IO 4.x
- JWT auth (jsonwebtoken + bcryptjs), express-validator, helmet, express-rate-limit

### Patterns — always follow these
```js
// Controller — always wrap with asyncHandler
const asyncHandler = require('../utils/asyncHandler');
exports.doThing = asyncHandler(async (req, res) => {
  // ...
  res.json({ success: true, data: { ... } });
});

// Error — use AppError, never throw plain Error
const { AppError } = require('../utils/errors');
throw new AppError('ERROR_CODE', 'Human message', 404);

// Route — auth first, then validators, then controller
router.get('/path', auth, validators, controller.method);
```

### Response shape
```js
// Success
{ success: true, data: { ... } }

// Error
{ success: false, error: { code: 'ERROR_CODE', message: '...' } }
```

### Key files
| File | Purpose |
|------|---------|
| `src/app.js` | Express bootstrap, middleware, route mounting |
| `src/config/db.js` | MongoDB connection with retry |
| `src/middleware/auth.js` | `auth`, `requireRole`, `requireOperationalRole` |
| `src/middleware/errorHandler.js` | Global error handler |
| `src/utils/errors.js` | `AppError` class |
| `src/utils/asyncHandler.js` | Async wrapper for controllers |
| `src/realtime/socket.js` | Socket.IO init, `getIO()` |
| `src/services/breachService.js` | Stateful AO breach detection |
| `src/services/locationService.js` | Location update handling |
| `src/services/presenceService.js` | Connected user tracking |

### Domain model
- **User**: location (GeoJSON Point, 2dsphere index), role (`admin`/`user`), operationalRole, unitId/companyId/teamId/squadId
- **AO**: GeoJSON Polygon, companyId, active, style
- **ViolationEvent**: type (`APPROACHING_BOUNDARY` | `BREACH` | `SUSTAINED_BREACH`), userId, aoId, coordinates, timestamp
- **Hierarchy**: Company → Unit → Team → Squad
- **Coordinate convention**: MongoDB/GeoJSON = `[lng, lat]` · Leaflet = `[lat, lng]` ← common bug source

### Socket events
`location:update`, `location:request`, `presence:subscribe`, `viewport:subscribe`

### Operational roles (descending authority)
`HQ` > `UNIT_COMMANDER` > `COMPANY_COMMANDER` > `TEAM_LEADER` > `SQUAD_COMMANDER`

---

## Client (client/src/)

### Stack
- React 18 with hooks only (no class components)
- Vite 5 — use `import.meta.env.VITE_*` (never `process.env`)
- Tailwind CSS 3.x with custom dark theme
- Leaflet 1.9 + react-leaflet 4.x + leaflet-draw
- Axios with JWT interceptors via `services/api.js`
- Socket.IO client via `services/socketService.js`

### Design system — always match this
```
Backgrounds:   bg-jet (#0a0a0a)  bg-charcoal (#1a1a1a)  bg-slate-dark (#2d2d2d)
Primary:       text-gold (#C7A76C)   bg-gradient-to-r from-gold to-gold-light
Borders:       border-gold/20  border-gold/40
Effects:       shadow-gold-glow   backdrop-blur-glass
Animations:    animate-fade-in   animate-slide-up
Text:          text-white (primary)  text-gray-400 (secondary)  text-red-400 (error)
```

### Existing UI components — use these, don't recreate
```
components/ui/Button.jsx   — variants: primary | secondary | outline | ghost
components/ui/Card.jsx     — glass-card with gold border
components/ui/Input.jsx    — dark styled input
components/ui/Modal.jsx    — overlay modal
```

### Key files
| File | Purpose |
|------|---------|
| `src/App.jsx` | Routing, ProtectedRoute, AdminRoute |
| `src/pages/Dashboard.jsx` | Main map view, live location, socket |
| `src/pages/Admin.jsx` | AO management, violations list |
| `src/pages/AdminManagement.jsx` | User + hierarchy management |
| `src/services/api.js` | Axios instance with JWT interceptor |
| `src/services/socketService.js` | Socket.IO client singleton |

### Map patterns
- `MapContainer` parent div must have explicit height (`h-screen` or `h-[calc(...)]`)
- Use `useMap()` hook for imperative control (`setView`, `flyTo`)
- Leaflet coordinates are `[lat, lng]` — opposite of GeoJSON

---

## Common Bug Patterns

| Symptom | Likely cause |
|---------|-------------|
| Socket 401 after login | JWT not passed in socket handshake `auth` field |
| AO breach false positives | `AO_BREACH_GRACE_MS` env var too low |
| Wrong marker position | Coordinate swap — passing `[lng, lat]` to Leaflet |
| Map invisible / zero height | Missing height on `MapContainer` parent div |
| Vite env var undefined | Using `process.env` instead of `import.meta.env` |
| React infinite re-render | Missing `useCallback`/`useMemo` in Dashboard deps |
| Scope error non-admin | `scopeResolver.js` not populating `req.scope` correctly |

---

## Dev Commands
```bash
# Server
cd server && npm run dev      # nodemon on port 5000

# Client
cd client && npm run dev      # Vite on port 5173
```
