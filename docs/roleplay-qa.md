# Roleplay QA (Happy Wanderer)

Lightweight, repeatable checks for invite flow, The Score access, and moderation.
Testing-only guide. Do not use these roles for real contributor onboarding.
Use these roles and scripts so every LLM dev validates the same behaviors.

## One-command setup
Run this to mint a fresh invite and print a ready-to-use LLM prompt:
```bash
node scripts/roleplay-setup.js
```

## Roles (minimal, high coverage)
- Admin (conductor): approve Notes, toggle trusted, review pending queue.
- Trusted contributor: new Notes auto-publish.
- New contributor: Notes default to pending.
- Invite-only browser: no auth, invite cookie only.
- Chain-forwarder: creates child invites to test depth/uses/expiry.
- Adversarial: attempts to access restricted routes or publish without trust.

Suggested email aliases (Gmail):
- mrsamygrant+admin@gmail.com
- mrsamygrant+trusted@gmail.com
- mrsamygrant+new@gmail.com

## Test accounts (roleplay-only)
- Admin (conductor): `mrsamygrant+admin@gmail.com`
- Trusted contributor: `mrsamygrant+trusted@gmail.com`
- New contributor: `mrsamygrant+new@gmail.com`
- Invite-only browser: no login (use invite link in incognito)
- Chain-forwarder: no login (forward invite link)
- Adversarial: no login (attempt restricted routes)

## LLM prompt template (copy/paste)
```text
You are testing Happy Wanderer in roleplay mode. Use docs/roleplay-qa.md.

Roles available:
- Admin: mrsamygrant+admin@gmail.com (ask me for OTP or password)
- Trusted contributor: mrsamygrant+trusted@gmail.com (ask me for OTP or password)
- New contributor: mrsamygrant+new@gmail.com (ask me for OTP or password)
- Invite-only browser: use invite link I provide

Follow the roleplay scripts and report:
- What you tried
- What worked
- What broke
- Any unexpected access or privacy issues

Do not invent memories or details. Stay factual and testing-only.
```

## Dev-only test login (optional)
If `TEST_LOGIN_SECRET` is set, you can mint a local session without email/OTP.

Quick page: `/test-login` (dev only).

POST example:
```bash
curl -s -X POST "http://localhost:3000/api/test/login" \
  -H "Content-Type: application/json" \
  -H "x-test-login-secret: $TEST_LOGIN_SECRET" \
  -d '{"email":"mrsamygrant+admin@gmail.com"}'
```

GET example (browser redirect, local only):
```
http://localhost:3000/api/test/login?secret=YOUR_SECRET&email=mrsamygrant+admin@gmail.com
```

Notes:
- Dev-only (disabled in production).
- Uses Supabase magic-link OTP internally; no email is sent.
## Setup checklist
- Add admin emails to `ADMIN_EMAILS` in `.env.local`.
- Ensure `INVITE_COOKIE_SECRET` is set.
- Optional: set `ROLEPLAY_ADMIN_EMAIL`, `ROLEPLAY_TRUSTED_EMAIL`, `ROLEPLAY_NEW_EMAIL`.
- Restart dev server after env changes.

## Scripts (roleplay flows)

### 1) Invite-only browsing
1. Create an invite from a Note (or `/edit` → invite).
2. Open invite link in incognito (no auth).
3. Expected: invite cookie minted, can browse `/score` and published Notes.
4. Expected: cannot access `/share` or `/edit` (redirect to login).

### 2) Forwarded invite behavior (chain-mail)
1. Forward the invite link to a second browser/device.
2. Expected: link works until `max_uses` or expiry (72h).
3. Expected: browsing only; no posting unless via `/respond/[id]`.

### 3) Respond without identity
1. Use `/respond/[id]` with no auth.
2. Submit a Note.
3. Expected: Note status is `pending`.
4. Expected: Note is not visible in The Score.

### 4) Admin moderation
1. Log in as admin and open `/admin`.
2. Approve a pending Note.
3. Expected: Note becomes visible in The Score.
4. Set a pending Note to `private`.
5. Expected: Note is hidden from The Score and `/memory/:id` for non-owners.

### 5) Trusted contributor autopublish
1. Log in as admin and mark a contributor as trusted.
2. As that contributor, add a new Note.
3. Expected: Note status is `published` immediately.
4. Toggle trust off and repeat.
5. Expected: Notes default back to `pending`.

### 6) Boundary checks (adversarial)
1. Visit `/api/score` with no auth and no invite cookie.
2. Expected: 401.
3. Visit `/memory/:id` for a pending Note as invite-only browser.
4. Expected: blocked (not found or redirect).

## Expected outcomes summary
- Invite cookie grants browse-only access to The Score and published Notes.
- `/respond/[id]` allows submissions without auth, but Notes are `pending`.
- Admin approves or hides pending Notes in `/admin`.
- Trusted contributors auto-publish; untrusted contributors go pending.
- Non-invite, non-auth sessions cannot access `/api/score` or private/pending Notes.

## Notes
- Invite defaults: 72h expiry, 10 uses, max depth 3.
- Invite cookie TTL: 7 days.

## Test memory audit (human review)
Use this quick checklist for the roleplay seed memory:

- Title feels neutral and factual (no sensational tone).
- Content is warm, calm, and specific (no invented personal details).
- No sensitive data (medical, financial, private addresses, minors).
- `privacy_level` is `family` and status is `published`.
- If it fails: set to `private` or delete it via `/admin`.

## Automated smoke (Playwright)
- Spec: `tests/e2e/roleplay.spec.ts`
- Requires fixture headers (`E2E_FIXTURE_ENABLED=true`, `E2E_FIXTURE_KEY`).
- Fixture runs should start a fresh dev server (no `reuseExistingServer`).
- Optional admin check: set `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD`.
