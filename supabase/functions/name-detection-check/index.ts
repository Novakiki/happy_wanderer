// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../deno.d.ts" />
// Edge function: name-detection-check
// Uses gpt5-mini gateway to extract names from text.

type DetectRequest = {
  content: string;
  people?: Array<{ id?: string; name?: string }>;
};

const buildNerPrompt = (content: string): string => {
  const system = [
    'You are a precise, permissive NER helper for family memories.',
    'Goal: list every person name you can find, one name per element, in order of appearance.',
    'Include single-token names (e.g., "Julie", "Ben"), multi-token names (e.g., "Uncle Bob", "Jordan Cline Anderson"), nicknames, and likely given names even if lowercase.',
    'If a token looks like a person name, INCLUDE it. Err on the side of inclusion for human names.',
    'Exclude places, orgs, objects, pronouns, titles alone, and fictional figures unless clearly a person in context.',
    'Return JSON with a top-level array named "names" and nothing else.',
  ].join(' ');

  return `${system}\n\nText:\n${content}\n\nReturn JSON with {"names":["name1","name2",...]} (no other fields).`;
};

/**
 * Call gpt5-mini gateway to extract person names.
 */
async function detectNamesLLM(content: string): Promise<string[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const functionSecret = Deno.env.get('LLM_FUNCTION_SECRET');

  if (!supabaseUrl || !functionSecret) {
    console.warn('Missing SUPABASE_URL or LLM_FUNCTION_SECRET');
    return [];
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
    return [];
  }

  const data = await resp.json();
  const resultStr = data?.result;
  if (typeof resultStr !== 'string') return [];

  try {
    const parsed = JSON.parse(resultStr);
    const arr = Array.isArray(parsed) ? parsed : parsed.names;
    return Array.isArray(arr)
      ? arr.map((n) => (typeof n === 'string' ? n : '')).filter(Boolean)
      : [];
  } catch {
    return [];
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
    const llmNames = await detectNamesLLM(content);
    const all = Array.from(new Set<string>(llmNames));

    return Response.json({
      names: all,
      llm_used: Boolean(llmNames.length),
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
