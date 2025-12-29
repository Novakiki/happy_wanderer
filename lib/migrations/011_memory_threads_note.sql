-- Add optional explainer note for memory thread links
ALTER TABLE memory_threads
  ADD COLUMN IF NOT EXISTS note TEXT;
