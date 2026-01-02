# Auth, Invite Access, and Moderation

## Purpose
Happy Wanderer is invite-only, low-friction, and private. Invitees can browse The Score, but access stays gated. Notes are added with care: new contributors default to pending, trusted contributors can publish.

This document is the source of truth for access rules, invite lineage, and moderation defaults.

## Glossary
- **Invite**: A record that grants temporary browse access and an invitation to respond.
- **Invite session**: A short-lived, cookie-backed browse-only session minted from an invite.
- **Edit session**: `vals-memory-edit` cookie for note editing via magic links.
- **Trusted contributor**: A contributor allowed to auto-publish Notes.

## Access Rules (MUST/NEVER)
- MUST: `/score`, `/memory/*`, `/api/score`, and `/api/score-peek` require Supabase auth **or** a valid invite session cookie.
- MUST: `/respond/*` remains public; it mints invite sessions after validating an invite.
- MUST: Use service-role queries only after a gate check (auth or invite session).
- MUST: Notes from `/respond/*` default to `pending`.
- NEVER: grant edit rights via invite sessions.
- NEVER: store raw invite tokens in cookies.

## Invite Graph (thin, intentional)
We model invite lineage, not a full social graph.

Invites include:
- `parent_invite_id` (nullable)
- `depth` (int, default 0)
- `max_uses` (default 10)
- `uses_count` (default 0)
- `expires_at` (default now + 72 hours)

Defaults:
- Invite expiry: **72 hours**
- Max uses per invite: **10**
- Max depth: **3**

## Invite Sessions (browse-only)
Invite sessions are short-lived cookies used to browse The Score.

- Cookie name: `vals-memory-invite`
- TTL: **7 days**
- Scope: browse-only (no posting or editing)
- Minted in `/api/respond` after validating invite validity and limits
- Signed with a server secret (`INVITE_COOKIE_SECRET`, fallback to `SUPABASE_SECRET_KEY`)

## Posting & Moderation
- Untrusted contributors: Notes default to `pending`.
- Trusted contributors (`contributors.trusted = true`): Notes default to `published`.
- `private` remains for drafts/unlisted Notes.

Note sources:
- `/respond/*`: always `pending` by default.
- `/share` (authenticated): `published` only if trusted.

## Trust Model
We use a manual trust flag for contributors:
- `contributors.trusted` (boolean, default false)
- Admins can flip it at any time.

## Forwarding Philosophy
Invite links may be forwarded. Forwarding is bounded by:
- expiry (72 hours)
- max uses (10)
- depth (3)

This keeps the group-chat energy while limiting blast radius.

## Guardrails
- Invite sessions never grant edit permissions.
- Invite sessions never override privacy levels.
- Pending Notes are not visible in The Score.

## Decision Log
- Phone invites are first-class.
- `/respond/*` allows expression without identity proof; contributions are `pending`.
- Invite sessions enable browsing The Score without full auth.
- Trusted contributors auto-publish; everyone else defaults to pending.
