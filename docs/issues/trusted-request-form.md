# Trusted Status Request Form

## Summary

Add a tiny in-app flow for contributors to request trusted status, with a simple admin queue to approve or decline. This keeps the experience inside Happy Wanderer, avoids exposing an admin email, and creates an auditable record.

## Context

Right now contributors see a generic "review" notice, but there is no clear path to request trusted status. The result is ambiguity: people do not know how to move from pending to auto-publish, and admins do not have a consistent workflow to grant trust.

## Goals

- Give contributors a calm, clear way to request trusted status inside the site.
- Keep the flow invite-only; no public email or external tooling.
- Provide a lightweight admin queue in `/admin` for approvals.
- Keep data model minimal and auditable.

## Non-Goals

- No role system beyond the existing `contributors.trusted`.
- No new dependencies or external services.
- No changes to invite or edit token models.

## User Experience

### Contributor

1) After submitting a Note, show a small callout:
   - "Your Note is pending review. Want future Notes to publish immediately?"
   - Button: "Request trusted status"
2) On `/edit` (Your notes), show the same callout if they are untrusted and have no open request.
3) Request form fields:
   - Optional short message (one sentence).
   - Submit button.
4) Success state:
   - "Request received. We'll review it and let you know."

### Admin

1) `/admin` shows a "Trust requests" section above or below pending Notes.
2) Each request card: contributor name, relation, email, last active, request message, created date.
3) Actions: "Approve" (sets `contributors.trusted = true`), "Decline" (keeps untrusted).
4) Resolved requests are hidden by default (or shown in a collapsed "Resolved" list).

## Data Model (minimal)

New table: `trust_requests`

- `id` UUID (PK)
- `contributor_id` UUID (FK -> contributors.id)
- `message` TEXT NULL
- `status` TEXT NOT NULL DEFAULT 'pending' CHECK ('pending', 'approved', 'declined')
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `resolved_at` TIMESTAMPTZ NULL
- `resolved_by` UUID NULL (FK -> contributors.id)

Optional: unique partial index to prevent duplicates:
`UNIQUE (contributor_id) WHERE status = 'pending'`

## Routes / Endpoints

- `POST /api/trust-requests`
  - Auth required.
  - Creates a pending request (idempotent if one already exists).
- `PATCH /api/admin/trust-requests`
  - Admin only.
  - Body: `{ id, status }` where status is `approved` or `declined`.
  - If approved, also set `contributors.trusted = true`.

## Copy (Contributor)

Pending notice (after submit / in edit):
"Your Note is pending review. If you'd like future Notes to publish right away, you can request trusted status."

Button: "Request trusted status"
Success: "Request received. We'll review it and let you know."

## Acceptance Criteria

- [ ] Untrusted contributors see a "Request trusted status" CTA after submission and in `/edit`.
- [ ] Submitting the request creates one pending `trust_requests` row per contributor.
- [ ] Admins can approve/decline in `/admin`.
- [ ] Approving sets `contributors.trusted = true`.
- [ ] No public email or external workflow is required.
