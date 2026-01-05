-- Claim tokens for identity/visibility management via SMS
-- When someone is mentioned in a memory, they receive an SMS with a claim link
-- that lets them control how their name appears without requiring signup.

CREATE TABLE IF NOT EXISTS claim_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL UNIQUE,
  invite_id UUID REFERENCES invites(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  event_id UUID REFERENCES timeline_events(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- SMS delivery tracking
  sms_status TEXT DEFAULT 'pending' CHECK (sms_status IN ('pending', 'sent', 'delivered', 'failed')),
  sms_sent_at TIMESTAMPTZ,
  sms_sid TEXT  -- Twilio message SID for status tracking
);

CREATE INDEX IF NOT EXISTS idx_claim_tokens_token ON claim_tokens(token);
CREATE INDEX IF NOT EXISTS idx_claim_tokens_invite ON claim_tokens(invite_id);
CREATE INDEX IF NOT EXISTS idx_claim_tokens_event ON claim_tokens(event_id);
CREATE INDEX IF NOT EXISTS idx_claim_tokens_expires ON claim_tokens(expires_at);

-- RLS: Only service_role can access claim_tokens (no public access)
ALTER TABLE claim_tokens ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE claim_tokens TO service_role;
