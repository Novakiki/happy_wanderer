-- 027b_seed_signals.sql
-- Seed initial signals for Signal-first capture
-- Safe to re-run (idempotent via ON CONFLICT)

INSERT INTO motifs (label, definition, status, created_at)
VALUES
  ('her humor', 'The way humor moved through her', 'active', now()),
  ('how she decided', 'Her patterns of decision-making', 'active', now()),
  ('what she noticed', 'What caught her attention', 'active', now()),
  ('how she corrected', 'How she offered correction', 'active', now()),
  ('how she welcomed', 'How she made people feel received', 'active', now()),
  ('what she returned to', 'Themes and places she came back to', 'active', now()),
  ('how ordinary moments changed around her', 'The texture shift when she was present', 'active', now())
ON CONFLICT (label) DO NOTHING;
