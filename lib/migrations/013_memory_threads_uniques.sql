-- Ensure memory thread links are unique and indexed
ALTER TABLE memory_threads
ADD CONSTRAINT uq_memory_threads_pair UNIQUE (original_event_id, response_event_id);

CREATE INDEX IF NOT EXISTS idx_memory_threads_original_event_id
  ON memory_threads(original_event_id);

CREATE INDEX IF NOT EXISTS idx_memory_threads_response_event_id
  ON memory_threads(response_event_id);
