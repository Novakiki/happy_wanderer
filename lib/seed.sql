-- =============================================================================
-- Happy Wanderer - Seed Data
-- Run this after schema.sql to load initial content
-- =============================================================================

INSERT INTO contributors (id, name, relation, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Amy', 'cousin', NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert Derek as contributor
INSERT INTO contributors (id, name, relation, created_at) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Derek Anderson', 'husband', NOW())
ON CONFLICT (id) DO NOTHING;

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
    'This is where her story begins -- not with her, but with the naming of what she would carry. The word "chorea" comes from the Greek for dance. It shares a root with "chorus." Her score starts here.',
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
    'Happy Wanderer',
    'Valeri, valera -- a song that sang her name.',
    'In 1953, a German choir won an international competition with "Der froehliche Wanderer" -- Happy Wanderer. A BBC broadcast made it famous overnight. The chorus goes: "Valeri, valera, valeri, valera-ha-ha-ha-ha-ha, valeri, valera."',
    'The song literally sings her name. Her father sang it to her. Some things are too layered to be coincidence.',
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
  ),
  (
    '30000000-0000-0000-0000-000000000001',
    1986,
    'Summer',
    'memory',
    'Tom Cruise at Classic Skating (almost)',
    'We lined up to meet “Tom Cruise” at Classic Skating and kept our cups.',
    'The summer Top Gun came out, Val’s crush on Tom Cruise took over everything. When we heard he would be at Classic Skating in Orem serving drinks, we bought tickets early, counted the days, and met him—completely losing our minds. He was shorter than expected, but the face (or the GQ sunglasses) delivered. We kept our cups, debated whose fingers brushed his longest, and believed for years that we had met Tom Cruise. It took longer to realize he almost certainly wasn’t working a concession stand at a roller rink, no matter what the sign said.',
    'A family legend that shows how shared excitement and mischief lived in the small moments.',
    NULL,
    NULL,
    '00000000-0000-0000-0000-000000000001',
    'Orem, Utah',
    'published',
    'family'
  )
ON CONFLICT (id) DO NOTHING;

-- Add timing and people context for the Classic Skating memory
UPDATE timeline_events
SET
  timing_input_type = 'age_range',
  age_start = 10,
  age_end = 12,
  life_stage = 'childhood',
  timing_note = 'Loose guess on age; year tied to Top Gun release.',
  people_involved = ARRAY['Amy', 'Julie']
WHERE id = '30000000-0000-0000-0000-000000000001';

-- Insert references for events with source URLs
INSERT INTO event_references (event_id, type, url, display_name, role, added_by) VALUES
  -- George Huntington Wikipedia source
  (
    '10000000-0000-0000-0000-000000000001',
    'link',
    'https://en.wikipedia.org/wiki/George_Huntington',
    'Wikipedia',
    'source',
    '00000000-0000-0000-0000-000000000001'
  ),
  -- Happy Wanderer Wikiwand source
  (
    '10000000-0000-0000-0000-000000000002',
    'link',
    'https://www.wikiwand.com/en/articles/The_Happy_Wanderer',
    'Wikiwand',
    'source',
    '00000000-0000-0000-0000-000000000001'
  ),
  -- Happy Wanderer YouTube link
  (
    '10000000-0000-0000-0000-000000000002',
    'link',
    'https://www.youtube.com/watch?v=irInmv--DlE',
    'Listen to the song',
    'related',
    '00000000-0000-0000-0000-000000000001'
  );
