// Run with: npx tsx scripts/create-test-invite.ts

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env.local manually
const envFile = readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SECRET_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // 1. Check for existing MEMORY events (invites only work for memories)
  console.log('Checking for memory events...');
  const { data: events, error: eventsError } = await supabase
    .from('timeline_events')
    .select('id, title, type')
    .eq('type', 'memory')
    .limit(5);

  if (eventsError) {
    console.error('Error fetching events:', eventsError.message);
    process.exit(1);
  }

  if (!events || events.length === 0) {
    console.log('No events found. Creating a test event first...');

    // Create a test event
    const { data: newEvent, error: createError } = await supabase
      .from('timeline_events')
      .insert({
        title: 'Test Memory: Summer at the Lake',
        full_entry: 'Remember that summer we all went to the lake? The water was so clear you could see the fish swimming. Grandma made her famous potato salad.',
        preview: 'Remember that summer we all went to the lake?',
        type: 'memory',
        status: 'published',
        year: 1995,
        timing_certainty: 'approximate',
      })
      .select('id, title, type')
      .single();

    if (createError) {
      console.error('Error creating event:', createError.message);
      process.exit(1);
    }

    console.log('Created test event:', newEvent.title);
    events.push(newEvent);
  } else {
    console.log('Found events:', events.map(e => e.title).join(', '));
  }

  const eventId = events[0].id;

  // 2. Create a test invite
  console.log('\nCreating test invite...');
  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .insert({
      event_id: eventId,
      recipient_name: 'Test Cousin',
      recipient_contact: 'test@example.com',
      method: 'link',
      status: 'pending',
    })
    .select('id')
    .single();

  if (inviteError) {
    console.error('Error creating invite:', inviteError.message);
    process.exit(1);
  }

  console.log('\n✓ Test invite created!');
  console.log('\nOpen this URL to test:');
  console.log(`http://localhost:3000/respond/${invite.id}`);
}

main();
