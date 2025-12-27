-- Add latitude and longitude columns for map visualization
-- Run this in Supabase SQL Editor

ALTER TABLE timeline_events
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION;

-- Index for efficient spatial queries
CREATE INDEX idx_events_coordinates ON timeline_events(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON COLUMN timeline_events.latitude IS 'Latitude coordinate for map display, geocoded from location text';
COMMENT ON COLUMN timeline_events.longitude IS 'Longitude coordinate for map display, geocoded from location text';
