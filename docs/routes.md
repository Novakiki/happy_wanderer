# Routes overview

## Public
- `/respond/[id]` – invitation response (no auth required)
- `/auth/*` – login, signup, reset, complete-profile
- `/api/auth/*` – auth endpoints
- Static assets: `_next/static`, `_next/image`, `favicon.ico`, public files

## Auth-required
- `/score` – The Score (timeline)
- `/share` – Add a note
- `/edit` – Request magic link to edit submissions
- `/edit/[token]` – Edit via magic link
- Other app routes unless listed above

## Middleware/proxy
- Only `proxy.ts` is used (no `middleware.ts`).
- Matcher excludes static assets and allows `/respond` without auth.

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
