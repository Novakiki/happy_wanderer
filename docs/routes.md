# Routes overview

## Public
- `/respond/[id]` – invitation response (no auth required)
- `/identity` – how identity works (public explainer)
- `/auth/*` – login, signup, reset, complete-profile
- `/api/auth/*` – auth endpoints
- Static assets: `_next/static`, `_next/image`, `favicon.ico`, public files

## Auth-required
- `/score` – The Score (timeline)
- `/why` – Why this exists
- `/contribute` – Contribute (choose a path)
- `/share` – Write a note
- `/fragment` – Share a fragment (signal-first)
- `/submit` – Contributor submission flow
- `/edit` – Request magic link to edit submissions
- `/edit/[token]` – Edit via magic link
- `/settings` – Account settings (profile, identity visibility)
- `/admin` – Admin review (pending notes, trusted contributors)
- Other app routes unless listed above

## Invite-session access
- Invite sessions (`vals-memory-invite`) allow browse-only access to `/score`, `/memory/*`, `/api/score`, `/api/score-peek`.
- Invite sessions are minted by `/respond/[id]` after validating the invite.

## Route groups
- `(main)` contains contributor flows only: `/contribute`, `/share`, `/fragment`, and `/submit`.

## Middleware/proxy
- Only `proxy.ts` is used (no `middleware.ts`).
- Matcher excludes static assets and allows `/respond` without auth.
- Middleware allows invite-session access to The Score and note views.

## Redirects
- `/letter` → `/why` (legacy)

## Conventions
- API routes mirror page names (e.g., `/why` → `/api/why`, `/edit` → `/api/edit/*`).
- Avoid empty folders in `app/` without `page.tsx`, `layout.tsx`, or `route.ts`.

## Labels
- Nav anchor label: **Happy Wanderer**
- Score heading tag line: **Valerie Park Anderson**

## Entry types
- `memory`, `milestone`, `origin` (synchronicity)

## Reference roles
- `heard_from`, `witness`, `source`, `related`

## Maintenance
- See `docs/maintenance.md` for cleanup after E2E runs and schema sync reminders.

## See also
- `docs/llm-notes.md` (branding, auth vs public, Supabase, roles)
- `docs/architecture/auth-invite-access.md` (invite access + moderation rules)
- `AGENTS.md` (purpose, tone, metaphor, guardrails)

## TODO (LLM consistency)
- Keep route list in `docs/llm-notes.md` aligned with this file.
- Reconfirm route group usage if `(main)` expands beyond share/submit.
