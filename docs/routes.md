# Routes overview

## Public
- `/respond/[id]` – invitation response (no auth required)
- `/auth/*` – login, signup, reset, complete-profile
- `/api/auth/*` – auth endpoints
- Static assets: `_next/static`, `_next/image`, `favicon.ico`, public files

## Auth-required
- `/score` – The Score (timeline)
- `/why` – Why this exists
- `/share` – Add a note
- `/submit` – Contributor submission flow
- `/edit` – Request magic link to edit submissions
- `/edit/[token]` – Edit via magic link
- Other app routes unless listed above

## Route groups
- `(main)` contains contributor flows only: `/share` and `/submit`.

## Middleware/proxy
- Only `proxy.ts` is used (no `middleware.ts`).
- Matcher excludes static assets and allows `/respond` without auth.

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

## See also
- `docs/llm-notes.md` (branding, auth vs public, Supabase, roles)
- `AGENTS.md` (purpose, tone, metaphor, guardrails)

## TODO (LLM consistency)
- Keep route list in `docs/llm-notes.md` aligned with this file.
- Reconfirm route group usage if `(main)` expands beyond share/submit.
