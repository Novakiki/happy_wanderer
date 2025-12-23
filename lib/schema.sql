-- =============================================================================
-- THE HAPPY WANDERER - Database Schema
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

-- Themes - the recurring motifs
CREATE TABLE themes (
  id TEXT PRIMARY KEY,  -- "joy", "fire", "will", "care", "edges"
  label TEXT NOT NULL,  -- "Her Joy", "Her Fire"
  description TEXT,
  ai_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
  people_involved TEXT[],

  -- Admin & Privacy
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('published', 'pending', 'private')),
  privacy_level TEXT DEFAULT 'family' CHECK (privacy_level IN ('public', 'family', 'kids-only'))
);

-- Event themes (many-to-many)
CREATE TABLE event_themes (
  event_id UUID REFERENCES timeline_events(id) ON DELETE CASCADE,
  theme_id TEXT REFERENCES themes(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, theme_id)
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_events_year ON timeline_events(year);
CREATE INDEX idx_events_type ON timeline_events(type);
CREATE INDEX idx_events_status ON timeline_events(status);
CREATE INDEX idx_events_contributor ON timeline_events(contributor_id);
CREATE INDEX idx_witnesses_event ON witnesses(event_id);
CREATE INDEX idx_witnesses_status ON witnesses(status);
CREATE INDEX idx_invites_status ON invites(status);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE NOT read;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE witnesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_threads ENABLE ROW LEVEL SECURITY;

-- Public read access for published events
CREATE POLICY "Public can read published events" ON timeline_events
  FOR SELECT USING (status = 'published');

-- Public read access for themes
CREATE POLICY "Public can read themes" ON themes
  FOR SELECT USING (true);

-- Public read access for contributors (names only via join)
CREATE POLICY "Public can read contributors" ON contributors
  FOR SELECT USING (true);

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Insert Amy as the initial contributor
INSERT INTO contributors (id, name, relation, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Amy', 'cousin', NOW());

-- Insert Derek as contributor
INSERT INTO contributors (id, name, relation, created_at) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Derek Anderson', 'husband', NOW());

-- Insert themes
INSERT INTO themes (id, label, ai_generated) VALUES
  ('joy', 'Her Joy', false),
  ('fire', 'Her Fire', false),
  ('will', 'Her Will', false),
  ('care', 'Her Care', false),
  ('edges', 'Her Edges', false);

-- Insert timeline events
INSERT INTO timeline_events (id, year, date, type, title, preview, full_entry, why_included, source_url, source_name, contributor_id, location, status, privacy_level) VALUES
  -- Origins
  (
    '10000000-0000-0000-0000-000000000001',
    1872,
    'February 15',
    'origin',
    'Chorea',
    'Chorea comes from the Greek for "dance," and shares a root with "chorus."',
    'On February 15, 1872, a 22-year-old physician named George Huntington presented a paper titled "On Chorea" to the Meigs and Mason Academy of Medicine in Middleport, Ohio. Drawing on observations by his father and grandfather, he described a hereditary form of chorea that would come to bear his name.',
    'This is where her story begins — not with her, but with the naming of what she would carry. The word "chorea" comes from the Greek for dance. It shares a root with "chorus." Her score starts here.',
    'https://en.wikipedia.org/wiki/George_Huntington',
    'Wikipedia',
    '00000000-0000-0000-0000-000000000001',
    'Middleport, Ohio',
    'published',
    'public'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    1953,
    NULL,
    'origin',
    'The Happy Wanderer',
    'Valeri, valera — a song that sang her name.',
    'In 1953, a German choir won an international competition with "Der fröhliche Wanderer" — The Happy Wanderer. A BBC broadcast made it famous overnight. The chorus goes: "Valeri, valera, valeri, valera-ha-ha-ha-ha-ha, valeri, valera." Years later, Rodney Park — the most gifted pianist his family had ever known, a man who played entirely by ear — would sing this song to his daughter. Her name was Valerie.',
    'The song literally sings her name. And the German lyric "Mein Vater war ein Wandersmann" means "My father was a wanderer." Her father sang it to her. Some things are too layered to be coincidence.',
    'https://www.wikiwand.com/en/articles/The_Happy_Wanderer',
    'Wikiwand',
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'published',
    'public'
  ),
  -- Milestones
  (
    '20000000-0000-0000-0000-000000000001',
    1975,
    'October 13',
    'milestone',
    'Born',
    'Valerie arrives in Murray, Utah.',
    'Valerie was born on October 13, 1975, in Murray, Utah, to G. Rodney Park and Carolyn Jean Burr. She was raised in Bluffdale, Utah in a home filled with music, good humor, and love.',
    'The day the music started.',
    NULL,
    NULL,
    '00000000-0000-0000-0000-000000000002',
    'Murray, Utah',
    'published',
    'family'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    1996,
    'August 24',
    'milestone',
    'Married Derek',
    'Sealed in the Manti Utah Temple.',
    'On August 24, 1996, she married her eternal companion, Derek Anderson, in the Manti Utah Temple. Valerie loved Derek dearly.',
    'She became my whole world that day. Still is.',
    NULL,
    NULL,
    '00000000-0000-0000-0000-000000000002',
    'Manti, Utah',
    'published',
    'public'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    1998,
    NULL,
    'milestone',
    'Perry, Utah',
    'Made their home for nearly 27 years.',
    NULL,
    NULL,
    NULL,
    NULL,
    '00000000-0000-0000-0000-000000000002',
    'Perry, Utah',
    'published',
    'family'
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    2025,
    'September 27',
    'milestone',
    'September 27',
    'Held by those who loved her.',
    NULL,
    NULL,
    NULL,
    NULL,
    '00000000-0000-0000-0000-000000000002',
    NULL,
    'published',
    'family'
  );

-- Link marriage event to love theme
INSERT INTO event_themes (event_id, theme_id) VALUES
  ('20000000-0000-0000-0000-000000000002', 'joy');
