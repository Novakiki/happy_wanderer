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

## Kid Safety & Guardian Controls (Future)

**Goal:** Avoid subjective mood scoring. Keep control with kids and Derek using explicit, opt-in choices.

**Building blocks:**
- No filters baseline: show all kid-allowed notes.
- Gentle Mode toggle: hide notes explicitly marked sensitive.
- Ask-before-reveal prompt on sensitive notes.
- Personal filters kids can set once (topics to hide).
- Derek override per kid (hide/allow specific notes).

**Notes:**
- Sensitivity is manual (set by Derek/admin), not algorithmic.
- Store kid preferences locally by default; only save to profiles if needed.
