-- Convenience views for product-language naming
CREATE OR REPLACE VIEW notes AS
  SELECT * FROM timeline_events;

CREATE OR REPLACE VIEW note_references AS
  SELECT * FROM event_references;

CREATE OR REPLACE VIEW note_threads AS
  SELECT * FROM memory_threads;

COMMENT ON VIEW notes IS 'Alias for timeline_events (Note records).';
COMMENT ON VIEW note_references IS 'Alias for event_references (provenance/chain).';
COMMENT ON VIEW note_threads IS 'Alias for memory_threads (parallel notes).';
