# AGENTS.md

## Purpose
This repo builds **Happy Wanderer** — a private memory site for Valerie Park Anderson.
The name comes from a 1953 song whose chorus ("Valeri, valera") literally sings her name.
Her father, a gifted pianist who played by ear, sang this song to her.

It serves two experiences: kids who want to know their mom, and contributors who want
to share memories. The tone must be warm, calm, and factual.

## Musical Terminology (IMPORTANT)
The site uses a consistent musical score metaphor. **Always use these terms:**

| Term | Meaning | Example |
|------|---------|---------|
| **Happy Wanderer** | Site name | The song that sang her name |
| **The Score** | The complete timeline/collection | Nav label, main view |
| **Movements** | Major life phases | Movement I: Early Years |
| **Measures** | Time groupings (decades, eras) | 1975–1996 |
| **Notes** | Individual memories/entries | "Add a note to her score" |
| **Her Song** | The complete narrative (poetic) | "This is her song" |
| **Motifs** | Recurring patterns (not "themes") | Her Joy, Her Fire, Her Will, Her Care, Her Edges |

### Hierarchy
```
Happy Wanderer (site name / the song)
  └── The Score (the complete timeline)
        └── Movements (life phases)
              └── Measures (time periods)
                    └── Notes (individual memories)
```

**Motifs** weave across all movements — they are cross-cutting patterns, not categories.

### Etymology anchors
- **Chorea**: Greek for "dance," shares root with "chorus" — this is why the site connects dance, music, and community
- **Valeri, valera**: The chorus of Happy Wanderer — literally her name in song

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
- `/` → redirects to `/letter`
- `/letter` — note to her children (password gate + continue to score)
- `/score` — The Score (timeline visualization, dark theme)
- `/share` — contributor portal
- `/edit` — request magic link to edit submissions
- Edit session cookie: `vals-memory-edit`
- `/chat` — LLM chat (kids-facing assistant)
- `/memory/:id` — single note view

### Route groups
- `(main)` — share
- `/score` — dark immersive theme with its own layout

### Database
- Schema: `lib/schema.sql` (run in Supabase SQL Editor)
- Seed: `lib/seed.sql` (run after schema if you need the starter data)
- Types: `lib/database.types.ts`
- Client: `lib/supabase.ts` (query helpers)

### Key tables
- `timeline_events` — notes (the core content)
- `contributors` — people who share memories
- `witnesses` — people tagged in memories
- `invites` — sharing/viral cascade tracking
- `edit_tokens` — magic links for editing submissions
- `event_references` — attribution chain (who told whom, who was there)
- `memory_threads` — links between related accounts of the same story

## Story Attribution & Chain Mail (IMPORTANT)

The site supports both **linear storytelling** (chronological timeline) and **synchronized storytelling** (multiple perspectives on the same moment, stories that echo across time).

### The Chain Mail Metaphor

Three meanings, all intentional:

1. **Chain mail armor**: Interlocking rings that create strength through connection. No single person carries the whole story—the mesh holds because each link connects to others.

2. **Chain letters**: "Pass it on." Each recipient adds their piece. The `heard_from` field captures this—"I received this story from Uncle John, now I'm passing it to you."

3. **Mail as correspondence**: The intimate act of sharing. Not broadcast, not archive—*letter*. A memory addressed to someone.

### Reference Roles

The `event_references` table tracks **provenance**—not just "what happened" but "how do we know":

| Role | Meaning | Use case |
|------|---------|----------|
| `heard_from` | "I heard this story from this person" | The original storyteller (can be invited to add their version) |
| `witness` | "This person was there" | Corroboration, someone who can confirm |
| `source` | External factual source | Wikipedia, news article, document |
| `related` | Related content | YouTube video, photo album, etc. |

### Memory Threads

The `memory_threads` table links related accounts:

| Relationship | Meaning |
|--------------|---------|
| `perspective` | Same story, different teller (the core chain mail link) |
| `addition` | One story completes another |
| `correction` | One story revises another |
| `related` | Stories that rhyme across time |

### The Form as Epistemology

The MemoryForm captures how stories propagate through families:

```
WHO is telling       → submitter_name, submitter_relationship
WHO told them        → heard_from (the chain mail link)
WHO was there        → witnesses (person references)
WHAT supports it     → sources (link references)
WHAT it responds to  → prompted_by_event_id (completing the chain)
```

Most family stories are **retold, not witnessed**. The `heard_from` field makes this chain visible. When someone checks "invite them to share their version," they're extending the chain—saying: "I've been carrying your story. Do you want to carry it yourself now?"

### Access gate
- Password via cookie "vals-memory-auth"
- `proxy.ts` guards routes

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
- Entry type rules: `docs/content.md`

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
- Top-level routes are linked where needed (score layout)
