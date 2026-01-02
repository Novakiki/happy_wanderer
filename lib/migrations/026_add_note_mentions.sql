-- Persisted mention candidates (LLM suggestions) with explicit promotion gate.
CREATE TABLE IF NOT EXISTS note_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
  mention_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'context', 'ignored', 'promoted')),
  visibility TEXT NOT NULL DEFAULT 'pending'
    CHECK (visibility IN ('pending', 'approved', 'anonymized', 'blurred', 'removed')),
  display_label TEXT,
  source TEXT NOT NULL DEFAULT 'llm'
    CHECK (source IN ('llm', 'user')),
  created_by UUID REFERENCES contributors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  promoted_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  promoted_reference_id UUID REFERENCES event_references(id) ON DELETE SET NULL,
  CONSTRAINT note_mentions_subject_check
    CHECK (
      normalized_text NOT IN (
        'val',
        'valerie',
        'valeri',
        'valera',
        'valeria',
        'valerius',
        'valerie anderson',
        'valerie park anderson'
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_note_mentions_event_norm_source
  ON note_mentions(event_id, normalized_text, source);

CREATE INDEX IF NOT EXISTS idx_note_mentions_event
  ON note_mentions(event_id);

CREATE INDEX IF NOT EXISTS idx_note_mentions_status
  ON note_mentions(status);

ALTER TABLE note_mentions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE note_mentions TO service_role;
