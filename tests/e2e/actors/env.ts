import { createClient } from '@supabase/supabase-js';

export const fixtureEnabled = process.env.E2E_FIXTURE_ENABLED === 'true';
export const fixtureKey = process.env.E2E_FIXTURE_KEY;

export const adminEmail = process.env.E2E_ADMIN_EMAIL;
export const testLoginSecret = process.env.TEST_LOGIN_SECRET;
export const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

const adminEmailFallback =
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .find(Boolean) || '';

export const resolvedAdminEmail = (adminEmail || adminEmailFallback || '').trim().toLowerCase();

export const adminClient = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
