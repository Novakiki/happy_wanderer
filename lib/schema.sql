-- =============================================================================
-- Happy Wanderer - Database Schema
-- Run this in Supabase SQL Editor to create all tables
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Contributors - people who share memories
CREATE TABLE contributors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  relation TEXT NOT NULL,  -- "sister", "cousin", "husband", "friend"
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ
);

-- People - identity nodes (separate from accounts)
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_name TEXT NOT NULL,
  visibility TEXT DEFAULT 'pending'
    CHECK (visibility IN ('pending', 'approved', 'anonymized', 'blurred', 'removed')),
  created_by UUID REFERENCES contributors(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Person aliases - name variants for search and matching
CREATE TABLE person_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  kind TEXT,
  created_by UUID REFERENCES contributors(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Person claims - link identities to accounts
CREATE TABLE person_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES contributors(id),
  UNIQUE (person_id, contributor_id),
  UNIQUE (contributor_id)
);

-- Timeline events - the core content
CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year INTEGER NOT NULL,
  date TEXT,  -- "October 13", "February 15"

  -- Content
  type TEXT NOT NULL CHECK (type IN ('origin', 'milestone', 'memory')),
  title TEXT NOT NULL,
  preview TEXT,
  full_entry TEXT,
  why_included TEXT,

  -- Source & Attribution
  source_url TEXT,
  source_name TEXT,
  contributor_id UUID REFERENCES contributors(id),

  -- Context
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  people_involved TEXT[],

  -- Admin & Privacy
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('published', 'pending', 'private')),
  privacy_level TEXT DEFAULT 'family' CHECK (privacy_level IN ('public', 'family')),

  -- Story chain: links to the event this is responding to
  prompted_by_event_id UUID REFERENCES timeline_events(id),
  trigger_event_id UUID REFERENCES timeline_events(id), -- UI surface that prompted this submission
  root_event_id UUID REFERENCES timeline_events(id),
  chain_depth INTEGER DEFAULT 0,

  -- Timing flexibility
  timing_certainty TEXT DEFAULT 'approximate' CHECK (timing_certainty IN ('exact', 'approximate', 'vague')),
  timing_input_type TEXT DEFAULT 'year' CHECK (timing_input_type IN ('date', 'year', 'year_range', 'age_range', 'life_stage')),
  year_end INTEGER,
  age_start INTEGER,
  age_end INTEGER,
  life_stage TEXT CHECK (life_stage IN ('childhood', 'teens', 'college', 'young_family', 'beyond')),
  timing_note TEXT,

  -- Family constellation
  subject_id UUID REFERENCES contributors(id)
);

-- Media attachments
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('photo', 'video', 'audio', 'document')),
  url TEXT NOT NULL,
  caption TEXT,
  year INTEGER,
  uploaded_by UUID REFERENCES contributors(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event media (many-to-many)
CREATE TABLE event_media (
  event_id UUID REFERENCES timeline_events(id) ON DELETE CASCADE,
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, media_id)
);

-- =============================================================================
-- SOCIAL / VIRAL FEATURES
-- =============================================================================

-- Witnesses - people who were present at a memory
CREATE TABLE witnesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES timeline_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_method TEXT CHECK (contact_method IN ('email', 'sms', 'link')),
  contact_info TEXT,
  status TEXT DEFAULT 'not-invited' CHECK (status IN ('not-invited', 'invited', 'viewed', 'contributed')),
  invited_at TIMESTAMPTZ,
  contributed_event_id UUID REFERENCES timeline_events(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invites - tracking outreach
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES timeline_events(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  recipient_contact TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('email', 'sms', 'link')),
  message TEXT,
  sender_id UUID REFERENCES contributors(id),

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'clicked', 'contributed')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  contributed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constellation members (her father, children, etc.)
CREATE TABLE constellation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  relation_to_subject TEXT NOT NULL,  -- "father", "son", "daughter"
  birth_year INTEGER,
  passing_year INTEGER,
  contributor_id UUID REFERENCES contributors(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Edit tokens - magic links for editing submissions
CREATE TABLE edit_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL UNIQUE,
  contributor_id UUID REFERENCES contributors(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES contributors(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new-memory', 'witness-request', 'contribution-added', 'memory-approved')),
  title TEXT NOT NULL,
  body TEXT,
  related_event_id UUID REFERENCES timeline_events(id),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memory threads (responses to memories)
CREATE TABLE memory_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_event_id UUID REFERENCES timeline_events(id) ON DELETE CASCADE,
  response_event_id UUID REFERENCES timeline_events(id) ON DELETE CASCADE,
  relationship TEXT CHECK (relationship IN ('perspective', 'addition', 'correction', 'related')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event references - people and external sources that support a memory
CREATE TABLE event_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,

  -- Reference type: 'person' (family member) or 'link' (external URL)
  type TEXT NOT NULL CHECK (type IN ('person', 'link')),

  -- For 'person' type: links to contributors table
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,

  -- Legacy link (kept for migration/backfill compatibility)
  contributor_id UUID REFERENCES contributors(id) ON DELETE SET NULL,

  -- For 'link' type: external URL reference
  url TEXT,
  display_name TEXT,

  -- Context for the reference (applies to both types)
  -- heard_from = "I heard this story from this person" (the original storyteller)
  -- witness = "This person was there" (corroboration)
  -- source = External factual source (Wikipedia, etc.)
  -- related = Related content (YouTube video, article)
  role TEXT CHECK (role IN ('heard_from', 'witness', 'source', 'related')),
  note TEXT,

  -- For person references: their relationship to the subject (Val)
  relationship_to_subject TEXT,

  -- Privacy control: how this reference should be displayed
  -- pending = shown anonymized until person decides
  -- approved = full name visible
  -- anonymized = show relationship only ("a cousin")
  -- blurred = show initials only ("S.M.")
  -- removed = reference not displayed
  visibility TEXT DEFAULT 'pending' CHECK (visibility IN ('pending', 'approved', 'anonymized', 'blurred', 'removed')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES contributors(id),

  -- Ensure person refs have person_id (or legacy contributor_id), link refs have url+display_name
  CONSTRAINT valid_person_ref CHECK (type != 'person' OR (person_id IS NOT NULL OR contributor_id IS NOT NULL)),
  CONSTRAINT valid_link_ref CHECK (type != 'link' OR (url IS NOT NULL AND display_name IS NOT NULL))
);

-- =============================================================================
-- VIEWS (CONVENIENCE ALIASES)
-- =============================================================================

CREATE OR REPLACE VIEW notes AS
  SELECT * FROM timeline_events;

CREATE OR REPLACE VIEW note_references AS
  SELECT * FROM event_references;

CREATE OR REPLACE VIEW note_threads AS
  SELECT * FROM memory_threads;

COMMENT ON VIEW notes IS 'Alias for timeline_events (Note records).';
COMMENT ON VIEW note_references IS 'Alias for event_references (provenance/chain).';
COMMENT ON VIEW note_threads IS 'Alias for memory_threads (parallel notes).';

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_events_year ON timeline_events(year);
CREATE INDEX idx_events_type ON timeline_events(type);
CREATE INDEX idx_events_status ON timeline_events(status);
CREATE INDEX idx_events_coordinates ON timeline_events(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX idx_events_contributor ON timeline_events(contributor_id);
CREATE INDEX idx_events_life_stage ON timeline_events(life_stage);
CREATE INDEX idx_events_timing_certainty ON timeline_events(timing_certainty);
CREATE INDEX idx_events_subject ON timeline_events(subject_id);
CREATE INDEX idx_events_root ON timeline_events(root_event_id);
CREATE INDEX idx_events_chain_depth ON timeline_events(chain_depth);
CREATE INDEX idx_people_visibility ON people(visibility);
CREATE INDEX idx_people_created_by ON people(created_by);
CREATE INDEX idx_person_aliases_person ON person_aliases(person_id);
CREATE INDEX idx_person_aliases_alias ON person_aliases(alias);
CREATE INDEX idx_person_claims_person ON person_claims(person_id);
CREATE INDEX idx_person_claims_contributor ON person_claims(contributor_id);
CREATE INDEX idx_witnesses_event ON witnesses(event_id);
CREATE INDEX idx_witnesses_status ON witnesses(status);
CREATE INDEX idx_invites_status ON invites(status);
CREATE INDEX idx_edit_tokens_token ON edit_tokens(token);
CREATE INDEX idx_edit_tokens_contributor ON edit_tokens(contributor_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE NOT read;
CREATE INDEX idx_references_event ON event_references(event_id);
CREATE INDEX idx_references_contributor ON event_references(contributor_id);
CREATE INDEX idx_references_type ON event_references(type);
CREATE INDEX idx_references_visibility ON event_references(visibility);
CREATE INDEX idx_references_person ON event_references(person_id);
CREATE INDEX idx_events_prompted_by ON timeline_events(prompted_by_event_id);
CREATE INDEX idx_memory_threads_original ON memory_threads(original_event_id);
CREATE INDEX idx_memory_threads_response ON memory_threads(response_event_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE witnesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE edit_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE constellation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_references ENABLE ROW LEVEL SECURITY;

-- Public read access for published events
CREATE POLICY "Public can read published events" ON timeline_events
  FOR SELECT USING (status = 'published');

-- Public read access for contributors (names only via join)
CREATE POLICY "Public can read contributors" ON contributors
  FOR SELECT USING (true);

-- Public read access for event references (excludes removed)
-- Note: Masking (pending/anonymized/blurred) is handled at the application layer
CREATE POLICY "Public can read visible references" ON event_references
  FOR SELECT USING (visibility IS NULL OR visibility != 'removed');

-- Public read access for constellation
CREATE POLICY "Public can read constellation" ON constellation_members
  FOR SELECT USING (true);

-- =============================================================================
-- PRIVILEGES
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON TABLE
  contributors,
  timeline_events,
  media,
  event_media,
  event_references,
  constellation_members,
  notes,
  note_references,
  note_threads
TO anon, authenticated;

GRANT ALL ON TABLE
  contributors,
  people,
  person_aliases,
  person_claims,
  timeline_events,
  media,
  event_media,
  witnesses,
  invites,
  edit_tokens,
  notifications,
  constellation_members,
  memory_threads,
  event_references,
  notes,
  note_references,
  note_threads
TO service_role;
