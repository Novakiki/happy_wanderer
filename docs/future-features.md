# Future Features

## Weekly Digest Email for Derek

**Purpose:** Light curation without bottlenecking submissions

**How it works:**
- Submissions publish immediately (trust-first)
- Weekly email to Derek summarizing new entries
- Includes: title, contributor, preview, quick link to view/edit
- He can hide or edit anything that needs adjustment

**Implementation options:**
- Supabase Edge Function + pg_cron
- External service (Resend, Postmark) with scheduled trigger
- Vercel Cron job calling an API route

**Data needed:**
- Derek's email (or admin emails in a config)
- Query: `timeline_events` created in last 7 days
- Template: simple HTML email with entry summaries

---

## Interpretive Scene Mode (Her Song playback)

**Purpose:** Let kids experience Notes as gentle scenes derived from The Score, without claiming literal truth.

**Guardrails:**
- Always label as interpretive; link the exact Notes used.
- Never fabricate details; unknowns stay unknown.
- Never speak as Val; no voice imitation.
- Respect privacy levels; masked identities stay masked.

**How it works:**
- Generate a storyboard or short animatic from one Note, a Measure, or a Motif.
- Surface a "Based on these Notes" panel with sources and timestamps.
- Optional ambient score that reflects Motifs (no literal biographical claims).

**Data needed:**
- Note content, timing, location (if present), Motif tags, privacy level.
- Optional media references (photos, audio, documents).

---

## Audience assumptions

Current scope assumes all users are adults (18+). Kid-specific safety/guardian controls are out of scope.

---

## Removal requests with safe rewrites

**Purpose:** Let someone remove their identity from a Note, and optionally request a rewrite that keeps the story without identifying them.

**How it works:**
- Anyone mentioned can choose "Remove me from this Note" immediately (identity hidden).
- Optional "Request Note removal or rewrite" goes to Valerie/admin for review.
- If rewrite is chosen, the system suggests a redacted version that only paraphrases existing text.
- Human approval required before any rewrite is published.
- Original is preserved in history for provenance; public view uses the redacted version.

**Guardrails:**
- No new facts; only reword or remove identifying clauses.
- Privacy rules always apply (masked identities stay masked).
- Never speak as Val or imply consent.

---

## Name masking follow-ups

**Purpose:** Keep public surfaces consistent with identity visibility rules.

**How it works:**
- Generate timeline previews from masked content (not raw HTML).
- Add a submit-time prompt: "We detected these names - add them to references?"

**Guardrails:**
- Detection is suggestive only; no forced changes.
- Masking always happens server-side before public render.

---

## TODO: Verify respond defaults for logged-in invitees

**Purpose:** Confirm that established users see their default identity applied and only override per Note when they choose to.

**Checks:**
- Logged-in invitee: shows "Using your default" and hides the picker until "Change for this Note."
- Logged-out invitee: full picker remains visible.
- Submissions without override do not write a per-note visibility override.
