## Follow-ups: E2E stability + claim hardening + type safety (2026-01)

### Context

Recent work fixed Playwright failures and removed a PostgREST embed ambiguity. The suite passes, but there are a few clear follow-ups that would reduce fragility and make future changes safer.

### 1) Regenerate Supabase types and remove `any` casts

**Why**
- There are several `as any` / `unknown as` escapes around tables/views that are not represented (or have drifted) in `lib/database.types.ts`.
- This increases risk of silent runtime breakage (especially around PostgREST embeds, `select()` shapes, and `upsert()` conflict keys).

**Where**
- `app/api/score/route.ts` (casts for `visibility_preferences`)
- `app/api/claim/verify/route.ts` + `app/api/claim/send/route.ts` (casts for `claim_tokens`, `visibility_preferences`)

**Acceptance**
- `lib/database.types.ts` includes `claim_tokens` and any other currently-used tables/views missing from the generated types.
- Remove `as any` / `unknown as` workarounds added solely for missing types.
- `npm run build` passes and `npm run test:e2e` still passes.

### 2) Hard-link claim tokens to people: populate `claim_tokens.person_id` at creation time

**Why**
- `/api/claim/verify` currently uses a fallback matching strategy (name matching; then “single person ref” fallback).
- This is acceptable as a stopgap, but the robust design is to store the target `person_id` when the token is created so claims can be purely ID-based and non-ambiguous.

**Where**
- Token creation: `app/api/claim/send/route.ts` (and/or wherever claim tokens are created for SMS/email flows)
- Claim processing: `app/api/claim/verify/route.ts`
- Schema: `lib/migrations/025_add_claim_tokens.sql` (already includes `person_id`, but it is not reliably populated by the sender)

**Acceptance**
- On token creation, resolve and persist the intended `person_id` in `claim_tokens`.
- `/api/claim/verify` POST first-class path is ID-based: find/update the exact `event_reference` for `event_id + person_id` (no fuzzy matching).
- If `person_id` is missing (legacy tokens), keep a conservative fallback path (but log/flag for cleanup).

### 3) Middleware allowlist audit: ensure unauthenticated routes are safe by construction

**Why**
- To support edit-token flows, we allow unauthenticated access to `/edit`, `/api/edit/*`, and `/api/trust-requests`.
- This is correct for UX, but it increases the importance of consistent server-side checks (token/cookie validation and strict row scoping) across all handlers.

**Where**
- Middleware gate: `lib/supabase/middleware.ts`
- Routes to audit:
  - `app/api/edit/*` (must enforce edit token / edit-session cookie for every read/write)
  - `app/api/trust-requests/route.ts` (must require logged-in user OR valid edit session mapping to a contributor)

**Acceptance**
- Every `/api/edit/*` endpoint has an explicit “authorization source” (edit session cookie token and/or validated token param) and cannot return data without it.
- Add at least one targeted test (unit or e2e) that proves an unauthenticated request without edit session cannot read or mutate notes.

### Optional: clarify policy in comments/docs (low effort)

**Why**
- Some comments describe `/api/score` as “public”, but current behavior is “auth/invite required” (as per E2E expectations).

**Acceptance**
- Update comments and any relevant docs so “what we intend” matches “what the code enforces”.
