# Maintenance Checklist

Use this to keep the database tidy after development and tests.

## After E2E runs
- Run `lib/cleanup.sql` in the Supabase SQL Editor to remove test invites, E2E notes, and expired edit tokens.

## After new migrations
- Run the new migration in Supabase SQL Editor.
- Keep `lib/schema.sql` in sync so fresh environments match production.

## Before demos
- Optional: run `lib/cleanup.sql` to remove leftover test data.
