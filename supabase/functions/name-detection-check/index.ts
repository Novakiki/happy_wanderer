// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../deno.d.ts" />
// Edge function: name-detection-check
// Uses gpt5-mini gateway to extract names from text.

type DetectRequest = {
  content: string;
  people?: Array<{ id?: string; name?: string }>;
};

type NameDetectionResult = {
  names: string[];
  public_names: string[];
  fictional_names: string[];
};

const EMPTY_DETECTION: NameDetectionResult = {
  names: [],
  public_names: [],
  fictional_names: [],
};

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

/**
 * Call gpt5-mini gateway to extract person names.
 */
function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function dedupeList(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(value);
  }
  return deduped;
}

async function detectNamesLLM(content: string): Promise<NameDetectionResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const functionSecret = Deno.env.get('LLM_FUNCTION_SECRET');

  if (!supabaseUrl || !functionSecret) {
    console.warn('Missing SUPABASE_URL or LLM_FUNCTION_SECRET');
    return EMPTY_DETECTION;
  }

  // Construct gpt5-mini URL from SUPABASE_URL
  const url = new URL(supabaseUrl);
  const host = url.hostname.replace('.supabase.co', '.functions.supabase.co');
  const gpt5MiniUrl = `${url.protocol}//${host}/gpt5-mini`;

  const prompt = buildNerPrompt(content);

  const resp = await fetch(gpt5MiniUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${functionSecret}`,
    },
    body: JSON.stringify({ prompt, stream: false }),
  });

  if (!resp.ok) {
    console.warn('gpt5-mini call failed:', resp.status, await resp.text());
    return EMPTY_DETECTION;
  }

  const data = await resp.json();
  const resultStr = data?.result;
  if (typeof resultStr !== 'string') return EMPTY_DETECTION;

  try {
    const parsed = JSON.parse(resultStr);
    const rawNames = Array.isArray(parsed) ? parsed : parsed?.names;
    const rawPublic = Array.isArray(parsed) ? [] : parsed?.public_names;
    const rawFictional = Array.isArray(parsed) ? [] : parsed?.fictional_names;

    const names = dedupeList(cleanList(rawNames));
    const nameSet = new Set(names.map((name) => name.toLowerCase()));
    const public_names = dedupeList(cleanList(rawPublic)).filter((name) =>
      nameSet.has(name.toLowerCase())
    );
    const fictional_names = dedupeList(cleanList(rawFictional)).filter((name) =>
      nameSet.has(name.toLowerCase())
    );

    return { names, public_names, fictional_names };
  } catch {
    return EMPTY_DETECTION;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = (await req.json()) as DetectRequest;
    const content = typeof body.content === 'string' ? body.content : '';
    const debug = typeof (body as { debug?: unknown }).debug === 'boolean'
      ? Boolean((body as { debug?: boolean }).debug)
      : false;

    if (!content.trim()) {
      return Response.json({ error: 'Missing content' }, { status: 400 });
    }

    // LLM only; dedupe
    const detected = await detectNamesLLM(content);

    return Response.json({
      names: detected.names,
      public_names: detected.public_names,
      fictional_names: detected.fictional_names,
      llm_used: Boolean(detected.names.length),
      ...(debug
        ? {
            received_content_excerpt: content.slice(0, 200),
            received_content_length: content.length,
          }
        : {}),
    });
  } catch (error) {
    console.error('name-detection-check error', error);
    return Response.json({ error: 'Failed to process content' }, { status: 500 });
  }
});
