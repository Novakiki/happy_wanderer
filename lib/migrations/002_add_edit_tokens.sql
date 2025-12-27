-- Add magic link edit tokens

CREATE TABLE IF NOT EXISTS edit_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL UNIQUE,
  contributor_id UUID REFERENCES contributors(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edit_tokens_token ON edit_tokens(token);
CREATE INDEX IF NOT EXISTS idx_edit_tokens_contributor ON edit_tokens(contributor_id);

ALTER TABLE edit_tokens ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE edit_tokens TO service_role;
