# LLM Orientation (Happy Wanderer)

## Branding & labels
- Site title (nav anchor): **Happy Wanderer**
- Score page heading line above title: **Valerie Park Anderson**
- Entry types: `memory`, `milestone`, `origin` (synchronicity)
- Reference roles: `heard_from`, `witness`, `source`, `related`

## Auth vs public
- Public: `/respond/*`, `/identity`, `/auth/*`, `/api/auth/*`
- Gated: everything else (middleware/proxy enforces)
- Proxy middleware lives in `proxy.ts` only (no `middleware.ts`)

## Key routes
- `/score` – timeline (The Score)
- `/share` – add a note (requires auth)
- `/submit` – contributor submission flow
- `/respond/[id]` – invited responses (no auth required)
- `/identity` – how identity works (public explainer)
- `/edit` and `/edit/[token]` – magic link editing
- `/settings` – account settings (profile, identity visibility)
- `/auth/*` – login/signup/reset/complete-profile
- `/why` – why this exists
- `/emerging` – “What’s Emerging”

## Interaction rules (UX behavior)
- `/score`: hover previews are desktop-only; click/tap opens `/memory/:id` directly (no detail modal).
- Editing happens on the full note page, not from the score preview.
- Full note page (`/memory/:id`) links to `/edit?event_id=...` for contributor edits.
- Invite responders can set per-note identity visibility on `/respond/[id]` and manage it later via `/respond/[id]?manage=1`.
- Logged-in contributors can claim their identity and manage visibility defaults in `/settings`.

## Supabase
- Server admin client: uses `SUPABASE_URL` + `SUPABASE_SECRET_KEY`
- Client anon: uses `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Project (prod): `https://qftgvihotgedvovzwczo.supabase.co`

## Content rules (short)
- Memory: firsthand moment/scene about Val.
- Milestone: dated life event/transition.
- Origin: synchronicity/meaningful association; must include source + why it matters.

## References
- People and links stored in `event_references`.
- Roles: `heard_from` (passed down), `witness` (was there), `source` (external), `related`.
- Invites can store the recipient's relationship to Val on the event's person reference (role: `witness`).

## Navigation components
- Primary nav: `components/Nav.tsx` (uses `SCORE_TITLE` for label, now “Happy Wanderer”).
- User menu: `components/UserMenu.tsx` (links include Edit notes).

## Middleware/proxy
- Use `proxy.ts` only; matcher allows `/respond` without auth.

## See also
- `docs/routes.md` (auth/public, labels)
- `AGENTS.md` (purpose, tone, metaphor, guardrails)
