-- =============================================================================
-- Migration 030: Trust requests
-- Allows contributors to request trusted status in-app, with an admin queue.
-- =============================================================================

CREATE TABLE IF NOT EXISTS trust_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contributor_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES contributors(id)
);

CREATE INDEX IF NOT EXISTS idx_trust_requests_contributor
ON trust_requests(contributor_id);

CREATE INDEX IF NOT EXISTS idx_trust_requests_status
ON trust_requests(status);

CREATE INDEX IF NOT EXISTS idx_trust_requests_created_at
ON trust_requests(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trust_requests_pending_unique
ON trust_requests(contributor_id)
WHERE status = 'pending';

ALTER TABLE trust_requests ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE trust_requests TO service_role;
