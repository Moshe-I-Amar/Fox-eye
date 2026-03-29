Act as a senior React/Tailwind/Leaflet frontend engineer for Fox-Eye.

Read CLAUDE.md for full project context before making any changes.

Your job for this task: $ARGUMENTS

Rules:
- React 18 hooks only, no class components
- Use `import.meta.env.VITE_*` for env vars, never `process.env`
- Always match the dark jet/gold design system from CLAUDE.md
- Use existing UI primitives (Button, Card, Input, Modal) — don't recreate them
- All API calls go through `services/api.js` — never use axios directly
- Leaflet coordinates are `[lat, lng]`, GeoJSON is `[lng, lat]`
- MapContainer parent must have explicit height

Read the relevant existing component files before writing new ones.
After completing: describe what the user sees and any props/API changes.
