#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const DEFAULT_BASE_URL = 'http://localhost:3000';

const DEFAULT_ROLES = {
  admin: 'mrsamygrant+admin@gmail.com',
  trusted: 'mrsamygrant+trusted@gmail.com',
  new: 'mrsamygrant+new@gmail.com',
};

const TEST_MEMORIES = [
  {
    title: 'Test memory: Kitchen afternoon',
    full_entry: 'We were in the kitchen. The radio was on low. Late afternoon light fell across the counter. This is a test memory.',
    preview: 'Kitchen scene (test).',
    year: 1996,
  },
  {
    title: 'Test memory: Front steps',
    full_entry: 'We sat on the front steps after dinner, talking for a while. This is a test memory.',
    preview: 'Front steps (test).',
    year: 1988,
  },
  {
    title: 'Test memory: Drive home',
    full_entry: 'We drove home in quiet, windows cracked, the day easing out. This is a test memory.',
    preview: 'Drive home (test).',
    year: 2002,
  },
].map((entry) => ({
  ...entry,
  type: 'memory',
  status: 'published',
  timing_certainty: 'approximate',
  privacy_level: 'family',
}));

function loadEnvFile(filename, env) {
  const filePath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (!key || key in env) continue;
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }
}

function buildLoginUrl(baseUrl, secret, email) {
  if (!secret) return '';
  const params = new URLSearchParams({
    secret,
    email,
  });
  return `${baseUrl.replace(/\/$/, '')}/api/test/login?${params.toString()}`;
}

async function ensureMemoryEvent(admin) {
  const titles = TEST_MEMORIES.map((entry) => entry.title);
  const { data: existing, error } = await admin
    .from('timeline_events')
    .select('id, title')
    .in('title', titles);

  if (error) {
    throw new Error(`Failed to fetch timeline events: ${error.message}`);
  }

  const existingTitles = new Set((existing || []).map((row) => row.title));
  const toInsert = TEST_MEMORIES.filter((entry) => !existingTitles.has(entry.title));

  let inserted = [];
  if (toInsert.length > 0) {
    const { data, error: insertError } = await admin
      .from('timeline_events')
      .insert(toInsert)
      .select('id, title');

    if (insertError) {
      throw new Error(`Failed to create test events: ${insertError.message}`);
    }

    inserted = data || [];
  }

  const allEvents = [...(existing || []), ...inserted];
  if (allEvents.length === 0) {
    throw new Error('No test events available.');
  }

  return allEvents[0];
}

async function createInvite(admin, eventId) {
  const { data: invite, error } = await admin
    .from('invites')
    .insert({
      event_id: eventId,
      recipient_name: 'Roleplay Browser',
      recipient_contact: 'roleplay@example.com',
      method: 'link',
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !invite) {
    throw new Error(`Failed to create invite: ${error?.message || 'unknown error'}`);
  }

  return invite.id;
}

async function main() {
  const env = { ...process.env };
  loadEnvFile('.env.e2e', env);
  loadEnvFile('.env.local', env);

  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SECRET_KEY;
  const baseUrl = env.E2E_BASE_URL || DEFAULT_BASE_URL;
  const testSecret = env.TEST_LOGIN_SECRET || '';

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY.');
    process.exit(1);
  }

  const roles = {
    admin: env.ROLEPLAY_ADMIN_EMAIL || DEFAULT_ROLES.admin,
    trusted: env.ROLEPLAY_TRUSTED_EMAIL || DEFAULT_ROLES.trusted,
    new: env.ROLEPLAY_NEW_EMAIL || DEFAULT_ROLES.new,
  };

  const admin = createClient(supabaseUrl, supabaseKey);

  console.log('\nRoleplay setup\n==============');

  const event = await ensureMemoryEvent(admin);
  const inviteId = await createInvite(admin, event.id);
  const inviteLink = `${baseUrl.replace(/\/$/, '')}/respond/${inviteId}`;

  const adminLogin = buildLoginUrl(baseUrl, testSecret, roles.admin);
  const trustedLogin = buildLoginUrl(baseUrl, testSecret, roles.trusted);
  const newLogin = buildLoginUrl(baseUrl, testSecret, roles.new);

  console.log(`Invite link: ${inviteLink}`);
  if (adminLogin) {
    console.log(`Admin login: ${adminLogin}`);
    console.log(`Trusted login: ${trustedLogin}`);
    console.log(`New contributor login: ${newLogin}`);
  } else {
    console.log('Dev login disabled: missing TEST_LOGIN_SECRET.');
  }

  const promptLines = [
    'You are testing Happy Wanderer in roleplay mode.',
    'Use this prompt when validating invite, access, and moderation flows.',
    'Use docs/roleplay-qa.md for scripts and expectations.',
    '',
    'Access links:',
    `- Invite-only browser: ${inviteLink}`,
  ];

  if (adminLogin) {
    promptLines.push(
      `- Admin login: ${adminLogin}`,
      `- Trusted contributor login: ${trustedLogin}`,
      `- New contributor login: ${newLogin}`
    );
  }

  promptLines.push(
    '',
    'Follow the roleplay scripts and report:',
    '- What you tried',
    '- What worked',
    '- What broke',
    '- Any unexpected access or privacy issues',
    '',
    'Do not invent memories or details. Stay factual and testing-only.'
  );

  console.log('\nPrompt (copy/paste)\n-------------------');
  console.log(promptLines.join('\n'));
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
