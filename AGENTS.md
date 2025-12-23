# AGENTS.md

## Purpose
This repo builds **The Happy Wanderer** — a private memory site for Valerie Park Anderson.
The name comes from a 1953 song whose chorus ("Valeri, valera") literally sings her name.
Her father, a gifted pianist who played by ear, sang this song to her.

It serves two experiences: kids who want to know their mom, and contributors who want
to share memories. The tone must be warm, calm, and factual.

## Musical Terminology (IMPORTANT)
The site uses a consistent musical score metaphor. **Always use these terms:**

| Term | Meaning | Example |
|------|---------|---------|
| **The Happy Wanderer** | Site name | The song that sang her name |
| **The Score** | The complete timeline/collection | Nav label, main view |
| **Movements** | Major life phases | Movement I: Early Years |
| **Measures** | Time groupings (decades, eras) | 1975–1996 |
| **Notes** | Individual memories/entries | "Add a note to her score" |
| **Her Song** | The complete narrative (poetic) | "This is her song" |
| **Motifs** | Recurring patterns (not "themes") | Her Joy, Her Fire, Her Will, Her Care, Her Edges |

### Hierarchy
```
The Happy Wanderer (site name / the song)
  └── The Score (the complete timeline)
        └── Movements (life phases)
              └── Measures (time periods)
                    └── Notes (individual memories)
```

**Motifs** weave across all movements — they are cross-cutting patterns, not categories.

### Etymology anchors
- **Chorea**: Greek for "dance," shares root with "chorus" — this is why the site connects dance, music, and community
- **Valeri, valera**: The chorus of The Happy Wanderer — literally her name in song

## Audience and tone
- Kids portal: gentle, reassuring, honest
- Contributor portal: invitational, reflective, specific
- Admin portal: practical and clear
- Never sensationalize or invent

## Architecture summary
- Next.js App Router (Next.js 16)
- Supabase for database (PostgreSQL)
- Cloudflare for hosting

### Key routes
- `/` → redirects to `/chapters` (The Score)
- `/chapters` — The Score (timeline visualization, dark theme)
- `/meet` — kids portal ("Hear")
- `/share` — contributor portal ("Keep")
- `/admin` — admin dashboard
- `/motifs/:id` — filter by motif
- `/photos`, `/letters`, `/voices` — kids sections

### Route groups
- `(main)` — warm paper theme with Navigation component
- `chapters` — dark immersive theme with its own layout

### Database
- Schema: `lib/schema.sql` (run in Supabase SQL Editor)
- Types: `lib/database.types.ts`
- Client: `lib/supabase.ts` (query helpers)

### Key tables
- `timeline_events` — notes (the core content)
- `contributors` — people who share memories
- `themes` — motifs (Her Joy, Her Fire, etc.)
- `witnesses` — people tagged in memories
- `invites` — sharing/viral cascade tracking

### Access gate
- Password via cookie "vals-memory-auth"
- middleware.ts guards routes

## Data and privacy rules
- Chat responses must only use approved memories and obituary facts
- Never fabricate details or speak as Val
- Privacy levels in database: `public`, `family`, `kids-only`
- Status levels: `published`, `pending`, `private`
- Every note needs: source attribution (URL, contributor name/relation), and "why this note"

## Design system

### Warm theme (main pages)
- Fonts: Newsreader (serif), Sora (sans)
- Palette in globals.css: --paper, --paper-deep, --ink, --ink-soft, --clay, --sage, --blush
- Background: soft paper gradient, warm and earthy
- UI: rounded 3xl cards, subtle borders, soft shadows

### Dark theme (The Score / chapters)
- Background: `#0a0a0a`
- Accent: `#e07a5f` (terracotta)
- Timeline bars animate with `animate-rise`
- Modals use backdrop blur
- Typography: white with varying opacity (white/95, white/70, white/40, etc.)

## Content and safety
- If a question is not covered by memories, say so clearly
- Attribute every memory to a source when possible
- Avoid medical speculation or private details
- If a request is sensitive or unclear, ask before writing

## Engineering guardrails
- Prefer small, explicit changes over refactors
- Use apply_patch for single-file edits
- ASCII only unless a file already uses Unicode
- Do not add dependencies unless asked
- Do not modify package-lock.json or package.json unless requested

## Workflow expectations
- If instructions are ambiguous, ask a short clarification first
- Summarize changes and list files touched
- Mention tests run or explicitly say none were run

## Done means
- New routes render without errors
- Mobile layout is readable
- Navigation updated for any new top-level routes
