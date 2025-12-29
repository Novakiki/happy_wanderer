# Happy Wanderer Data Model Glossary

This is a plain-language map between the site’s musical metaphor and the
database terms you will see in code or SQL.

## Product language → Database
- Note (an individual memory/entry) → `timeline_events`
- The Score (the full timeline) → `timeline_events` (all rows)
- Parallel Notes / Threads → `memory_threads`
- The Chain (provenance, witnesses, sources) → `event_references`
- People (real-world identities referenced in notes) → `people`
- Contributors (people who submit notes) → `contributors`
- Auth profile (Supabase user link) → `profiles`
- Invites (respond links) → `invites`
- Edit sessions (magic link editing) → `edit_tokens`

## Convenience views (read-only aliases)
These are just friendly names for querying; they do not change the data model.
- `notes` → `timeline_events`
- `note_references` → `event_references`
- `note_threads` → `memory_threads`

## Visibility & masking
Identity masking is handled in the application layer (see `lib/references.ts`).
Both the reference row and the person row can set visibility, and the stricter
setting wins. When not approved, names display as a relationship label or
"someone."
