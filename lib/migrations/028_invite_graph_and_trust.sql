-- Add invite lineage + trust controls

ALTER TABLE contributors
  ADD COLUMN IF NOT EXISTS trusted BOOLEAN DEFAULT FALSE;

ALTER TABLE invites
  ADD COLUMN IF NOT EXISTS parent_invite_id UUID REFERENCES invites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS depth INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS uses_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE invites
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '72 hours');

CREATE INDEX IF NOT EXISTS idx_invites_parent ON invites(parent_invite_id);
CREATE INDEX IF NOT EXISTS idx_invites_expires_at ON invites(expires_at);
