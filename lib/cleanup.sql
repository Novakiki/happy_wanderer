-- Safe cleanup for test artifacts and expired tokens.
-- Run manually when you want to prune local/dev data.

-- Expired or long-used edit tokens
DELETE FROM edit_tokens
WHERE (expires_at IS NOT NULL AND expires_at < NOW())
   OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '7 days');

-- E2E invite artifacts (Playwright tests)
DELETE FROM invites
WHERE recipient_contact = 'invitee@example.com'
  AND message = 'Please add your perspective.';

-- E2E memory artifacts (Playwright tests)
DELETE FROM timeline_events
WHERE title ILIKE 'E2E Memory %';
