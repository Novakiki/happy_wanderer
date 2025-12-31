// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../deno.d.ts" />
// Edge function: name-detection-check
// Uses LLM (and no regex) to extract names from text.
type DetectRequest = {
  content: string;
  people?: Array<{ id?: string; name?: string }>;
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-5-mini-2025-08-07';

/**
 * Call OpenAI to extract person names (kept server-side).
 */
async function detectNamesLLM(content: string): Promise<string[]> {
  if (!OPENAI_API_KEY) return [];

  const system = [
    'You are a precise, permissive NER helper for family memories.',
    'Goal: list every person name you can find, one name per element, in order of appearance.',
    'Include single-token names (e.g., "Julie", "Ben"), multi-token names (e.g., "Uncle Bob", "Jordaon Cline Anderson"), nicknames, and likely given names even if lowercase.',
    'If a token looks like a person name, INCLUDE it. Err on the side of inclusion for human names.',
    'Exclude places, orgs, objects, pronouns, titles alone, and fictional figures unless clearly a person in context.',
    'Return JSON with a top-level array named "names" and nothing else.',
  ].join(' ');

  const userPrompt = `Text:\n${content}\n\nReturn JSON with {"names":["name1","name2",...]} (no other fields).`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    console.warn('OpenAI detection failed', await resp.text());
    return [];
  }

  const data = await resp.json();
  const contentStr = data?.choices?.[0]?.message?.content;
  if (!contentStr) return [];

  try {
    const parsed = JSON.parse(contentStr);
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

    if (!OPENAI_API_KEY) {
      return Response.json({ error: 'OPENAI_API_KEY missing' }, { status: 500 });
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
        : null),
    });
  } catch (error) {
    console.error('name-detection-check error', error);
    return Response.json({ error: 'Failed to process content' }, { status: 500 });
  }
});
