import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
}

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SECRET_KEY']);

async function main() {
  const eventId = '20000000-0000-0000-0000-000000000002';

  // Check ALL invites for this event
  const { data: allInvites } = await supabase
    .from('invites')
    .select('id, recipient_name, status')
    .eq('event_id', eventId);

  console.log('All invites for this event:', JSON.stringify(allInvites, null, 2));

  // Check event_references for this event
  const { data: refs } = await supabase
    .from('event_references')
    .select('*, person:people(id, canonical_name, visibility)')
    .eq('event_id', eventId);

  console.log('\nEvent references:', JSON.stringify(refs, null, 2));

  // Check the event author
  const { data: event } = await supabase
    .from('timeline_events')
    .select('contributor_id, contributor:contributors(id, name)')
    .eq('id', eventId)
    .single();

  console.log('\nEvent author:', JSON.stringify(event, null, 2));
}

main();
