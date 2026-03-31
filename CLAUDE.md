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
  res.json({ success: true, data: { ... } });
});

// Error — use AppError, never throw plain Error
const { AppError } = require('../utils/errors');
throw new AppError('ERROR_CODE', 'Human message', 404);

// Route — auth first, then validators, then controller
router.get('/path', auth, validators, controller.method);

// Transactions — wrap multi-doc writes
const withTransaction = require('../utils/withTransaction');
await withTransaction(async (session) => { ... });

// Audit — log all sensitive admin actions
const { logAdminAction } = require('../services/adminAuditService');
await logAdminAction({ action: 'invite.create', actorUserId, targetType: 'invite', targetId, after: doc });
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
| `src/app.js` | Express bootstrap, middleware, route mounting, request logging with token scrubbing |
| `src/config/db.js` | MongoDB connection with retry |
| `src/middleware/auth.js` | `auth`, `requireRole`, `requireOperationalRole` — also checks user.status/active |
| `src/middleware/authorize.js` | `assertRoleEditAuthority`, `assertCompanyAccess`, `OPERATIONAL_ROLE_RANK`, `requireAdminOrCompanyCommander` |
| `src/middleware/errorHandler.js` | Global error handler |
| `src/utils/errors.js` | `AppError` class |
| `src/utils/asyncHandler.js` | Async wrapper for controllers |
| `src/utils/withTransaction.js` | MongoDB session/transaction helper |
| `src/utils/roles.js` | `OPERATIONAL_ROLES` array — source of truth for role enums |
| `src/utils/validators.js` | All express-validator chains: validateRegister (inviteToken required), validateCreateInvite, validateLogin, validateLocation, validateAOCreate/Update, validateFieldEventCreate |
| `src/realtime/socket.js` | Socket.IO init, `getIO()` |
| `src/services/breachService.js` | Stateful AO breach detection |
| `src/services/locationService.js` | Location update handling |
| `src/services/presenceService.js` | Connected user tracking |
| `src/services/scopeResolver.js` | Populates `req.scope` — what data the current user can see |
| `src/services/hierarchyService.js` | `resolveHierarchyPath()`, `ensureNoActiveChildren()`, `getHierarchyTree()` |
| `src/services/adminAuditService.js` | `logAdminAction()` — writes to AdminAuditLog collection |
| `src/controllers/inviteController.js` | `createInvite`, `validateInviteToken`, `listInvites`, `revokeInvite` |
| `src/controllers/eventController.js` | `createEvent`, `listEvents`, `acknowledgeEvent`, `resolveEvent` |
| `src/models/InviteToken.js` | Invite token schema — token, roles, hierarchy, expiry, usedAt |
| `src/models/AdminAuditLog.js` | Audit trail schema — action, actorUserId, before/after |
| `src/models/FieldEvent.js` | Field event schema — eventType, senderId, GeoJSON Point coords, status lifecycle, denormalized hierarchy |
| `src/services/fieldEventService.js` | `createFieldEvent`, `listFieldEvents`, `acknowledgeFieldEvent`, `resolveFieldEvent`, `validateAntiSpoof` (velocity + timestamp skew) |
| `src/routes/eventRoutes.js` | Field event routes — POST rate-limited 10/hr per user ID |

### Domain model
- **User**: location (GeoJSON Point, 2dsphere index), role (`admin`/`user`), operationalRole, unitId/companyId/teamId/squadId (all required), status (`active`/`pending`/`rejected`, default `active`), active (bool, default true)
- **InviteToken**: token (32-byte hex, unique), createdBy, expiresAt, usedAt/usedBy, assignedRole, assignedOperationalRole, unitId/companyId/teamId/squadId, inviterName, active
- **AO**: GeoJSON Polygon, companyId, active, style
- **ViolationEvent**: type (`APPROACHING_BOUNDARY` | `BREACH` | `SUSTAINED_BREACH`), userId, aoId, coordinates, timestamp
- **AdminAuditLog**: action string (e.g. `invite.create`), actorUserId, targetType, targetId, before/after snapshots
- **FieldEvent**: eventType (`INJURED` | `AMBUSH` | `LINK_UP`), senderId, coordinates (GeoJSON Point, 2dsphere), status (`ACTIVE` | `ACKNOWLEDGED` | `RESOLVED`), acknowledgedBy/acknowledgedAt, resolvedBy/resolvedAt, unitId/companyId/teamId/squadId (denormalized from sender)
- **Hierarchy**: Unit → Company → Team → Squad (each has name, parentId, commanderId, active)
- **Coordinate convention**: MongoDB/GeoJSON = `[lng, lat]` · Leaflet = `[lat, lng]` ← common bug source

### Operational roles (descending authority)
`HQ` > `UNIT_COMMANDER` > `COMPANY_COMMANDER` > `TEAM_COMMANDER` > `SQUAD_COMMANDER`

Rank values (from `authorize.js`): HQ=5, UNIT_COMMANDER=4, COMPANY_COMMANDER=3, TEAM_COMMANDER=2, SQUAD_COMMANDER=1

### Account status lifecycle
Users have a `status` field: `active` | `pending` | `rejected`. The `auth` middleware throws 403 with specific error codes:

| Status | Error code | Meaning |
|--------|-----------|---------|
| `pending` | `AUTH_PENDING` | Account awaiting approval |
| `rejected` | `AUTH_REJECTED` | Account was rejected |
| `active=false` | `AUTH_INACTIVE` | Account deactivated |

### Invite system
Registration is invite-gated. Flow: admin creates invite → shares link → user visits `/register?token=...` → Register page validates token (`GET /api/auth/invite/:token`) → user submits form with inviteToken → server marks invite used and creates user with pre-assigned role/hierarchy.

**Invite rules:**
- Only HQ/UNIT_COMMANDER/COMPANY_COMMANDER can create invites
- Only HQ can create admin-role invites
- Actor rank must be > target operationalRole rank
- COMPANY_COMMANDER can only revoke their own invites
- Tokens expire after N days (1–30, default 7), single-use

### API endpoints
```
Auth (rate limited: 5/15min for login/register, 20/15min for invite):
  POST   /api/auth/register            # Invite-gated registration (inviteToken required)
  POST   /api/auth/login               # Email/password login
  GET    /api/auth/me                  # Current user profile (auth required)
  GET    /api/auth/invite/:token       # Validate invite token (public)

Users:
  GET    /api/users                    # All users (admin only)
  GET    /api/users/near               # Nearby users in scope (auth)
  GET    /api/users/:id                # Single user (admin)
  PUT    /api/users/me/location        # Update own location (auth)

Hierarchy (read-only):
  GET    /api/hierarchy/tree           # Full tree
  GET    /api/hierarchy/units|companies|teams|squads

AOs:
  GET    /api/aos                      # List AOs in scope (auth)
  POST   /api/aos                      # Create AO
  PUT    /api/aos/:id                  # Update AO
  PATCH  /api/aos/:id/active           # Toggle active
  DELETE /api/aos/:id                  # Delete AO

Violations:
  GET    /api/violations               # List in scope (auth)
  GET    /api/violations/:id           # Single violation

Field Events (rate limited: 10/hr per user for POST):
  GET    /api/events                   # List field events in scope (auth); ?status=&eventType=&page=&limit=
  POST   /api/events                   # Report field event — INJURED/AMBUSH/LINK_UP (auth)
  PATCH  /api/events/:id/acknowledge   # Acknowledge active event (auth)
  PATCH  /api/events/:id/resolve       # Resolve event (auth)

Admin (auth + admin role + HQ/UC/CC operationalRole):
  GET    /api/admin/hierarchy/tree
  POST   /api/admin/companies|teams|squads
  PUT    /api/admin/companies|teams|squads/:id
  DELETE /api/admin/companies|teams|squads/:id
  POST   /api/admin/users              # Create user
  PUT    /api/admin/users/:id          # Update user
  PATCH  /api/admin/users/:id/active   # Toggle active
  PATCH  /api/admin/users/:id/roles    # Change roles
  POST   /api/admin/invites            # Create invite
  GET    /api/admin/invites?status=active|used|expired
  DELETE /api/admin/invites/:id        # Revoke invite

System:
  GET    /api/health
```

### Socket events
`location:update`, `location:request`, `presence:subscribe`, `viewport:subscribe`

Field event broadcasts (server → in-scope sockets):
`field:event:new`, `field:event:acknowledged`, `field:event:resolved`

Socket connect now accepts optional session type: `socketService.connect(token, { sessionType: 'MOBILE' | 'WEB' })` — stored as `socket.sessionType` on the server (transient, not persisted).

---

## Client (client/src/)

### Stack
- React 18 with hooks only (no class components)
- Vite 5 — use `import.meta.env.VITE_*` (never `process.env`)
- Tailwind CSS 3.x with custom dark theme
- Leaflet 1.9 + react-leaflet 4.x + leaflet-draw
- Axios with JWT interceptors via `services/api.js`
- Socket.IO client via `services/socketService.js`

### Auth context — always use this, never read localStorage directly
```jsx
import { useAuth } from '../context/AuthContext';

const { user, authReady, login, logout, isAuthenticated } = useAuth();
// authReady = false while bootstrapping (show spinner, not redirect)
// login(token, userData) — stores token and updates state
// logout() — clears token and state
```
`AuthProvider` wraps the entire app in `App.jsx`. `useAuth()` must be called inside `AuthProvider`.

### Route protection — use RouteGuard, not the deleted route files
```jsx
// ProtectedRoute / AdminRoute / AdminManagementRoute are DELETED
// Use RouteGuard with props instead:
<RouteGuard requireRole="admin" requireOperationalRoles={['HQ','UNIT_COMMANDER']} fallback="/dashboard">
  <AdminManagement />
</RouteGuard>
```

### api.js account-state redirects
On 401 → redirects to `/login?reason=session-expired`
On 403 + account state code → redirects to `/login?reason=AUTH_PENDING|AUTH_REJECTED|AUTH_INACTIVE`
Login page reads `?reason=` and shows color-coded notice (gold=info, amber=warning, red=error).

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
| `src/App.jsx` | Routing wrapped in `<AuthProvider>`; uses `<RouteGuard>` for protected routes |
| `src/context/AuthContext.jsx` | `AuthProvider` + `useAuth()` hook — single source of truth for auth state |
| `src/components/layout/RouteGuard.jsx` | Composable route guard (props: requireRole, requireOperationalRoles, fallback) |
| `src/pages/Dashboard.jsx` | Main map view, live location, socket |
| `src/pages/Admin.jsx` | AO management, violations list |
| `src/pages/AdminManagement.jsx` | User + hierarchy management |
| `src/pages/Register.jsx` | Invite-gated registration — requires `?token=` URL param |
| `src/pages/Login.jsx` | Login + account-status notice display (reason codes in URL) |
| `src/services/api.js` | Axios instance with JWT interceptor + account-state redirect logic |
| `src/services/authApi.js` | `login()`, `register()`, `getMe()`, `validateInvite(token)` |
| `src/services/adminApi.js` | Admin CRUD + `createInvite()`, `listInvites()`, `revokeInvite()` |
| `src/services/eventApi.js` | `createEvent()`, `getEvents()`, `acknowledgeEvent()`, `resolveEvent()` |
| `src/services/socketService.js` | Socket.IO client singleton; `connect(token, { sessionType })` |
| `src/hooks/useFieldEvents.js` | Fetch + live socket subscription for field events; returns `{ events, loading, error, refetch }` |
| `src/pages/mobile/MobileFieldView.jsx` | Mobile page — GPS watcher, socket MOBILE session, status tracking; route `/mobile` |
| `src/pages/mobile/MobileLayout.jsx` | Mobile shell — `100dvh`, bottom nav (mobile) / sidebar (md+), safe-area padding; props: `connectionStatus`, `gpsStatus`, `onBack` |
| `src/pages/mobile/PanicPanel.jsx` | Three tactile panic buttons (INJURED/AMBUSH/LINK_UP); props: `userCoordinates`, `disabled` |
| `src/pages/mobile/MobileFieldMap.jsx` | Hierarchy-scoped Leaflet map; props: `userCoordinates`, `initialZoom`, `showZoomControl`; includes center-on-me FAB |
| `src/pages/mobile/MobileEventFeed.jsx` | Live field events list with refresh + active count; prop: `limit` |

### Map patterns
- `MapContainer` parent div must have explicit height (`h-screen`, `h-[calc(...)]`, or `h-full` inside a flex container)
- Mobile map uses `h-full` filling the flex-1 content area from `MobileLayout` — no pixel values
- Use `useMap()` hook for imperative control (`setView`, `flyTo`)
- Leaflet coordinates are `[lat, lng]` — opposite of GeoJSON

---

## Common Bug Patterns

| Symptom | Likely cause |
|---------|-------------|
| `useAuth` crash / context undefined | `useAuth()` called outside `<AuthProvider>` — check component tree in App.jsx |
| Register shows "Invite Required" modal | No `?token=` in URL — must use invite link |
| 403 AUTH_PENDING on login | `user.status === 'pending'` in DB — account not yet activated |
| Socket 401 after login | JWT not passed in socket handshake `auth` field |
| AO breach false positives | `AO_BREACH_GRACE_MS` env var too low |
| Wrong marker position | Coordinate swap — passing `[lng, lat]` to Leaflet |
| Map invisible / zero height | Missing height on `MapContainer` parent div |
| Vite env var undefined | Using `process.env` instead of `import.meta.env` |
| React infinite re-render | Missing `useCallback`/`useMemo` in Dashboard deps |
| Scope error non-admin | `scopeResolver.js` not populating `req.scope` correctly |
| Invite creation fails with rank error | Actor operationalRole rank ≤ target rank — only higher ranks can invite lower |
| Mobile map invisible | `MobileFieldMap` parent must be `h-full` inside a flex-1 container — `MobileLayout` content div handles this |
| Panic button disabled unexpectedly | `connectionStatus === 'disconnected'` in `MobileFieldView` — check socket connect/auth |
| Field event POST 422 velocity | Two rapid events with large coordinate delta — `validateAntiSpoof` in `fieldEventService.js` |

---

## Dev Commands
```bash
# Server
cd server && npm run dev      # nodemon on port 5000

# Client
cd client && npm run dev      # Vite on port 5173
```
