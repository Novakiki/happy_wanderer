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

## Audience assumptions

Current scope assumes all users are adults (18+). Kid-specific safety/guardian controls are out of scope.
