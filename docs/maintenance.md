# Maintenance Checklist

Use this to keep the database tidy after development and tests.

## After E2E runs
- Run `lib/cleanup.sql` in the Supabase SQL Editor to remove test invites, E2E notes, and expired edit tokens.

## E2E browser coverage (Playwright)

- Default (Level 2): runs on Desktop Chromium + Mobile Chromium.
- Optional (Level 3): add Mobile WebKit (Safari engine) by setting `E2E_LEVEL=3` (or `E2E_WEBKIT=true`) when running e2e tests.

### Handy commands

- Most of the time (Level 2 full suite): `npm run test:e2e`
- Fast sanity check (runs smoke tests on Desktop + Mobile): `npm run test:e2e:smoke`
- Mobile-only quick check: `npm run test:e2e:smoke:mobile`
- Occasional extra confidence (Level 3 full suite incl. Safari engine): `npm run test:e2e:l3`
- Optional Level 3 smoke only: `npm run test:e2e:smoke:l3`

## After new migrations
- Run the new migration in Supabase SQL Editor.
- Keep `lib/schema.sql` in sync so fresh environments match production.

## Before demos
- Optional: run `lib/cleanup.sql` to remove leftover test data.
