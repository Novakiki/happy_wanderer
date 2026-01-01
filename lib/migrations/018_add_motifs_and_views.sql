-- Add motifs, motif links, and view specs
CREATE TABLE IF NOT EXISTS motifs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,
  definition TEXT,
  created_by UUID REFERENCES contributors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'merged', 'deprecated')),
  merged_into_motif_id UUID REFERENCES motifs(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_motifs_label_active
  ON motifs (lower(label))
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS motif_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  motif_id UUID NOT NULL REFERENCES motifs(id) ON DELETE RESTRICT,
  note_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE RESTRICT,
  link_type TEXT NOT NULL DEFAULT 'supports' CHECK (link_type IN ('supports', 'contrasts', 'contextualizes')),
  link_confidence SMALLINT NOT NULL DEFAULT 3 CHECK (link_confidence BETWEEN 1 AND 5),
  created_by UUID REFERENCES contributors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  asserted_by TEXT NOT NULL DEFAULT 'curator' CHECK (asserted_by IN ('system', 'curator', 'contributor')),
  rationale TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  UNIQUE (motif_id, note_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_motif_links_motif_id
  ON motif_links(motif_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_motif_links_note_id
  ON motif_links(note_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS view_specs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE motifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE motif_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active motifs" ON motifs
  FOR SELECT USING (status = 'active');

CREATE POLICY "Public can read active motif links" ON motif_links
  FOR SELECT USING (status = 'active');

CREATE POLICY "Public can read view specs" ON view_specs
  FOR SELECT USING (true);

GRANT SELECT ON TABLE motifs, motif_links, view_specs TO anon, authenticated;
GRANT ALL ON TABLE motifs, motif_links, view_specs TO service_role;
