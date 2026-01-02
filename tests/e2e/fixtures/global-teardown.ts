import { createClient } from '@supabase/supabase-js';
import { clearFixtures, readFixtures } from './fixture-store';

type AdminClient = ReturnType<typeof createClient>;

async function cleanupNotes(admin: AdminClient, noteIds: string[]) {
  if (noteIds.length === 0) return;
  await admin.from('timeline_events').delete().in('id', noteIds);
}

export default async function globalTeardown() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    clearFixtures();
    return;
  }

  const fixtures = readFixtures();
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  if (fixtures.identityNotes && fixtures.identityNotes.length > 0) {
    await cleanupNotes(
      admin,
      fixtures.identityNotes.map((note) => note.id)
    );
  }

  clearFixtures();
}
