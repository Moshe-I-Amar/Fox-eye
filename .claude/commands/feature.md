Act as the Principal Engineer for Fox-Eye. Plan and implement a full feature end-to-end.

Read CLAUDE.md for full project context before starting.

Feature to build: $ARGUMENTS

Your process:
1. **Analyze** — understand what backend + frontend changes are needed
2. **Plan** — list every file that needs to change (server routes, controllers, models, client pages, services)
3. **Backend first** — implement server-side changes (API endpoint, service logic, model changes)
4. **Frontend second** — implement client-side changes (service call, UI component, page update)
5. **Review** — verify the data flows correctly end to end

Follow all patterns in CLAUDE.md exactly:
- Server: CommonJS, asyncHandler, AppError, `{ success: true, data: {} }` responses
- Client: React hooks, import.meta.env, jet/gold design system, existing UI primitives

After completing: provide a test checklist — exactly what to click/call to verify the feature works.
