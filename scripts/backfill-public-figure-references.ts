// Run with: npx tsx scripts/backfill-public-figure-references.ts --apply
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

type DetectionResult = {
  names: string[];
  public_names: string[];
  fictional_names: string[];
};

type EventRow = {
  id: string;
  title: string | null;
  year: number | null;
  full_entry: string | null;
  preview: string | null;
};

type ReferenceRow = {
  id: string;
  visibility: string | null;
  person_id: string | null;
  person: { id: string; canonical_name: string | null } | null;
};

type AliasRow = {
  person_id: string;
  alias: string;
};

type NameDetectionAttempt = {
  result: DetectionResult;
  hasTags: boolean;
};

const EMPTY_DETECTION: DetectionResult = {
  names: [],
  public_names: [],
  fictional_names: [],
};

const FICTIONAL_CHARACTERS = new Set([
  'santa',
  'santa claus',
  'father christmas',
  'st nick',
  'saint nick',
  'easter bunny',
  'tooth fairy',
  'jack frost',
  'cupid',
  'god',
  'jesus',
  'jesus christ',
  'christ',
  'devil',
  'satan',
  'cinderella',
  'snow white',
  'sleeping beauty',
  'rapunzel',
  'peter pan',
  'tinkerbell',
  'pinocchio',
  'boogeyman',
  'sandman',
  'mother nature',
]);

const buildNerPrompt = (content: string): string => {
  const system = [
    'You are a precise, permissive NER helper for family memories.',
    'Goal: list every person name you can find, one name per element, in order of appearance.',
    'Include single-token names (e.g., "Julie", "Ben"), multi-token names (e.g., "Uncle Bob", "Jordan Cline Anderson"), nicknames, and likely given names even if lowercase.',
    'If a token looks like a person name, INCLUDE it. Err on the side of inclusion for human names.',
    'Exclude places, orgs, objects, pronouns, titles alone.',
    'Do not exclude a name just because it is public or fictional; tag those in the lists below.',
    'Tag public figures (well-known real people like actors, presidents, historical figures) in "public_names".',
    'Tag fictional or mythic figures (Santa, Easter Bunny, etc.) in "fictional_names".',
    'Return JSON with keys: "names", "public_names", "fictional_names".',
    '"names" must include all person names. The other lists are subsets. If unsure, leave it out of public_names/fictional_names.',
  ].join(' ');

  return `${system}\n\nText:\n${content}\n\nReturn JSON with {"names":["name1","name2"],"public_names":["name2"],"fictional_names":[]} (no other fields).`;
};

const envFile = readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
}

const supabaseUrl = env['SUPABASE_URL'] || env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SECRET_KEY'] || env['SUPABASE_SERVICE_ROLE_KEY'];
const functionSecret = env['LLM_FUNCTION_SECRET'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE env vars');
  process.exit(1);
}

if (!functionSecret) {
  console.error('Missing LLM_FUNCTION_SECRET (needed for name detection)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const args = process.argv.slice(2);
const apply = args.includes('--apply');

function getArgValue(flag: string): string | null {
  const idx = args.findIndex((arg) => arg === flag || arg.startsWith(`${flag}=`));
  if (idx === -1) return null;
  const value = args[idx].includes('=')
    ? args[idx].split('=').slice(1).join('=')
    : args[idx + 1];
  return value || null;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

function hasPublicTags(payload: unknown): payload is { public_names?: unknown; fictional_names?: unknown } {
  if (!payload || typeof payload !== 'object') return false;
  const data = payload as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(data, 'public_names')
    || Object.prototype.hasOwnProperty.call(data, 'fictional_names');
}

function getFunctionsBaseUrl(urlText: string): string | null {
  try {
    const url = new URL(urlText);
    const host = url.hostname.replace('.supabase.co', '.functions.supabase.co');
    return `${url.protocol}//${host}`;
  } catch {
    return null;
  }
}

async function detectViaNameDetectionCheck(
  content: string,
  functionsBaseUrl: string
): Promise<NameDetectionAttempt | null> {
  try {
    const resp = await fetch(`${functionsBaseUrl}/name-detection-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${functionSecret}`,
      },
      body: JSON.stringify({ content }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.warn('name-detection-check failed:', resp.status, text);
      return null;
    }

    const data = await resp.json().catch(() => ({}));
    const result: DetectionResult = {
      names: Array.isArray((data as DetectionResult).names) ? (data as DetectionResult).names : [],
      public_names: Array.isArray((data as DetectionResult).public_names) ? (data as DetectionResult).public_names : [],
      fictional_names: Array.isArray((data as DetectionResult).fictional_names) ? (data as DetectionResult).fictional_names : [],
    };

    return {
      result,
      hasTags: hasPublicTags(data),
    };
  } catch (err) {
    console.warn('name-detection-check error:', err);
    return null;
  }
}

async function detectViaGpt5Mini(
  content: string,
  functionsBaseUrl: string
): Promise<DetectionResult> {
  const prompt = buildNerPrompt(content);

  try {
    const resp = await fetch(`${functionsBaseUrl}/gpt5-mini`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${functionSecret}`,
      },
      body: JSON.stringify({ prompt, stream: false }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.warn('gpt5-mini failed:', resp.status, text);
      return EMPTY_DETECTION;
    }

    const data = await resp.json().catch(() => ({}));
    const resultStr = (data as { result?: unknown })?.result;
    if (typeof resultStr !== 'string') return EMPTY_DETECTION;

    try {
      const parsed = JSON.parse(resultStr);
      const names = Array.isArray(parsed) ? parsed : parsed?.names;
      const publicNames = Array.isArray(parsed) ? [] : parsed?.public_names;
      const fictionalNames = Array.isArray(parsed) ? [] : parsed?.fictional_names;

      return {
        names: Array.isArray(names) ? names : [],
        public_names: Array.isArray(publicNames) ? publicNames : [],
        fictional_names: Array.isArray(fictionalNames) ? fictionalNames : [],
      };
    } catch {
      return EMPTY_DETECTION;
    }
  } catch (err) {
    console.warn('gpt5-mini error:', err);
    return EMPTY_DETECTION;
  }
}

function buildPersonNameMap(
  refs: ReferenceRow[],
  aliases: AliasRow[]
): Map<string, Set<string>> {
  const aliasMap = new Map<string, string[]>();
  for (const row of aliases) {
    const list = aliasMap.get(row.person_id) || [];
    list.push(row.alias);
    aliasMap.set(row.person_id, list);
  }

  const result = new Map<string, Set<string>>();
  for (const ref of refs) {
    if (!ref.person_id) continue;
    const names = new Set<string>();
    const canonical = ref.person?.canonical_name;
    if (canonical) names.add(normalizeName(canonical));
    const aliasList = aliasMap.get(ref.person_id) || [];
    aliasList.forEach((alias) => names.add(normalizeName(alias)));
    result.set(ref.person_id, names);
  }

  return result;
}

function buildNameReferenceMap(
  refs: ReferenceRow[],
  nameMap: Map<string, Set<string>>
): Map<string, { refId: string; personId: string; visibility: string }> {
  const result = new Map<string, { refId: string; personId: string; visibility: string }>();
  for (const ref of refs) {
    if (!ref.person_id) continue;
    const names = nameMap.get(ref.person_id);
    if (!names) continue;
    for (const name of names) {
      if (!result.has(name)) {
        result.set(name, {
          refId: ref.id,
          personId: ref.person_id,
          visibility: (ref.visibility ?? 'pending').toLowerCase(),
        });
      }
    }
  }
  return result;
}

async function findPersonByName(nameText: string): Promise<string | null> {
  const { data: aliasRows } = await supabase
    .from('person_aliases')
    .select('person_id')
    .ilike('alias', nameText)
    .limit(1);

  if (aliasRows && aliasRows.length > 0) {
    return (aliasRows[0] as { person_id: string }).person_id;
  }

  const { data: personRows } = await supabase
    .from('people')
    .select('id')
    .ilike('canonical_name', nameText)
    .limit(1);

  if (personRows && personRows.length > 0) {
    return (personRows[0] as { id: string }).id;
  }

  return null;
}

async function createPerson(name: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('people')
    .insert({
      canonical_name: name,
      visibility: 'approved',
    })
    .select('id')
    .single();

  if (error) {
    console.warn('Failed to create person:', error.message);
    return null;
  }

  return (data as { id?: string } | null)?.id ?? null;
}

async function createReference(
  eventId: string,
  personId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('event_references')
    .insert({
      event_id: eventId,
      type: 'person',
      person_id: personId,
      role: 'related',
      visibility: 'approved',
    });

  if (error) {
    console.warn('Failed to create reference:', error.message);
    return false;
  }

  return true;
}

function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

async function fetchPendingEventIds(): Promise<string[]> {
  const eventIds: string[] = [];
  const batchSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('event_references')
      .select('event_id')
      .eq('type', 'person')
      .eq('visibility', 'pending')
      .range(from, from + batchSize - 1);

    if (error) {
      throw new Error(`Failed to fetch pending references: ${error.message}`);
    }

    if (!data || data.length === 0) break;
    eventIds.push(...data.map((row) => (row as { event_id: string }).event_id));
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return Array.from(new Set(eventIds));
}

async function fetchEvents(eventIds: string[]): Promise<EventRow[]> {
  const events: EventRow[] = [];
  for (const chunk of chunkArray(eventIds, 100)) {
    const { data, error } = await supabase
      .from('timeline_events')
      .select('id, title, year, full_entry, preview')
      .in('id', chunk);

    if (error) {
      throw new Error(`Failed to fetch events: ${error.message}`);
    }

    if (data && data.length > 0) {
      events.push(...(data as EventRow[]));
    }
  }
  return events;
}

async function main() {
  const functionsBaseUrl = getFunctionsBaseUrl(supabaseUrl);
  if (!functionsBaseUrl) {
    console.error('Failed to build functions base URL');
    process.exit(1);
  }

  const eventFilter = getArgValue('--event');
  const limitValue = getArgValue('--limit');
  const limit = limitValue ? Number.parseInt(limitValue, 10) : null;

  const eventIds = eventFilter ? [eventFilter] : await fetchPendingEventIds();
  const filteredEventIds = limit ? eventIds.slice(0, limit) : eventIds;

  if (filteredEventIds.length === 0) {
    console.log('No events with pending references found.');
    return;
  }

  if (!apply) {
    console.log('Dry run mode: no updates will be written (use --apply to update).');
  }

  const events = await fetchEvents(filteredEventIds);
  const eventMap = new Map(events.map((event) => [event.id, event]));

  let supportsTags: boolean | null = null;
  let totalApproved = 0;
  let totalRemoved = 0;
  let totalCreated = 0;
  let processed = 0;

  for (const eventId of filteredEventIds) {
    const event = eventMap.get(eventId);
    if (!event) continue;

    const content = event.full_entry || event.preview || '';
    if (!content.trim()) continue;

    let detection: DetectionResult = EMPTY_DETECTION;
    if (supportsTags !== false) {
      const attempt = await detectViaNameDetectionCheck(content, functionsBaseUrl);
      if (attempt) {
        supportsTags = attempt.hasTags;
        if (attempt.hasTags) {
          detection = attempt.result;
        }
      } else {
        supportsTags = false;
      }
    }

    if (!supportsTags) {
      detection = await detectViaGpt5Mini(content, functionsBaseUrl);
    }

    const publicSet = new Set(detection.public_names.map(normalizeName));
    const fictionalSet = new Set(detection.fictional_names.map(normalizeName));

    if (publicSet.size === 0 && fictionalSet.size === 0) {
      processed += 1;
      continue;
    }

    const { data: refs, error: refsError } = await supabase
      .from('event_references')
      .select('id, visibility, person_id, person:people(id, canonical_name)')
      .eq('event_id', eventId)
      .eq('type', 'person');

    if (refsError) {
      console.warn('Skipping event refs due to error:', eventId, refsError.message);
      processed += 1;
      continue;
    }

    const referenceRows = (refs || []) as unknown as ReferenceRow[];
    const personIds = referenceRows
      .map((ref) => ref.person_id)
      .filter((id): id is string => Boolean(id));

    const aliasRows: AliasRow[] = [];
    if (personIds.length > 0) {
      const { data: aliases, error: aliasError } = await supabase
        .from('person_aliases')
        .select('person_id, alias')
        .in('person_id', personIds);

      if (aliasError) {
        console.warn('Alias lookup failed:', aliasError.message);
      } else if (aliases) {
        aliasRows.push(...(aliases as AliasRow[]));
      }
    }

    const personNameMap = buildPersonNameMap(referenceRows, aliasRows);
    const nameReferenceMap = buildNameReferenceMap(referenceRows, personNameMap);

    const approveIds: string[] = [];
    const removeIds: string[] = [];
    const createNames = new Map<string, string>();

    for (const ref of referenceRows) {
      if (!ref.person_id) continue;
      const visibility = (ref.visibility ?? 'pending').toLowerCase();
      if (visibility !== 'pending') continue;

      const names = personNameMap.get(ref.person_id);
      if (!names) continue;

      let isPublic = false;
      let isFictional = false;

      for (const name of names) {
        if (fictionalSet.has(name) || FICTIONAL_CHARACTERS.has(name)) {
          isFictional = true;
          break;
        }
        if (publicSet.has(name)) {
          isPublic = true;
        }
      }

      if (isFictional) {
        removeIds.push(ref.id);
      } else if (isPublic) {
        approveIds.push(ref.id);
      }
    }

    for (const publicName of detection.public_names) {
      const normalized = normalizeName(publicName);
      if (fictionalSet.has(normalized) || FICTIONAL_CHARACTERS.has(normalized)) continue;

      const existingRef = nameReferenceMap.get(normalized);
      if (existingRef) continue;

      if (!createNames.has(normalized)) {
        createNames.set(normalized, publicName);
      }
    }

    if (apply) {
      if (approveIds.length > 0) {
        const { error: approveError } = await supabase
          .from('event_references')
          .update({ visibility: 'approved' })
          .in('id', approveIds);

        if (approveError) {
          console.warn('Failed to approve references:', approveError.message);
        } else {
          totalApproved += approveIds.length;
        }
      }

      if (removeIds.length > 0) {
        const { error: removeError } = await supabase
          .from('event_references')
          .update({ visibility: 'removed' })
          .in('id', removeIds);

        if (removeError) {
          console.warn('Failed to remove references:', removeError.message);
        } else {
          totalRemoved += removeIds.length;
        }
      }

      for (const name of createNames.values()) {
        let personId = await findPersonByName(name);
        if (!personId) {
          personId = await createPerson(name);
        }
        if (!personId) continue;

        const created = await createReference(eventId, personId);
        if (created) totalCreated += 1;
      }
    } else {
      totalApproved += approveIds.length;
      totalRemoved += removeIds.length;
      totalCreated += createNames.size;
    }

    processed += 1;
    const label = event.title ? `${event.title}` : event.id;
    const yearLabel = event.year ? ` (${event.year})` : '';
    if (approveIds.length > 0 || removeIds.length > 0 || createNames.size > 0) {
      console.log(
        `Updated ${label}${yearLabel}: approve ${approveIds.length}, remove ${removeIds.length}, create ${createNames.size}`
      );
    }
  }

  console.log(
    `Done. Events processed: ${processed}. Approved: ${totalApproved}. Removed: ${totalRemoved}. Created: ${totalCreated}.`
  );
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
