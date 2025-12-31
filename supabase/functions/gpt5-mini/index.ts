// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../deno.d.ts" />
// Edge Function: gpt5-mini
// Calls an OpenAI-compatible chat endpoint with model "gpt-5-mini"
// Supports streaming (default) or non-streaming via query param or JSON body

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const url = new URL(req.url);
    let prompt = '';
    let stream = true;

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      prompt = typeof body.prompt === 'string' ? body.prompt : '';
      if (typeof body.stream === 'boolean') {
        stream = body.stream;
      }
    } else {
      prompt = url.searchParams.get('prompt') || '';
      stream = (url.searchParams.get('stream') ?? 'true').toLowerCase() !== 'false';
    }

    if (!prompt.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing prompt' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const functionSecret = Deno.env.get('LLM_FUNCTION_SECRET');
    if (!functionSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing LLM_FUNCTION_SECRET' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token !== functionSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    const baseUrl = Deno.env.get('OPENAI_BASE_URL') || 'https://api.openai.com';
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5-mini-2025-08-07';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing OPENAI_API_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (stream) {
      const sseStream = new ReadableStream({
        async start(controller) {
          try {
            const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                stream: true,
                messages: [
                  { role: 'system', content: 'You are a helpful assistant.' },
                  { role: 'user', content: prompt },
                ],
              }),
            });

            if (!resp.ok || !resp.body) {
              controller.enqueue(
                `data: ${JSON.stringify({ error: `OpenAI streaming failed: ${resp.status}` })}\n\n`
              );
              controller.close();
              return;
            }

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = decoder.decode(value, { stream: true });
              controller.enqueue(text.replace(/^/gm, 'data: ') + '\n');
            }
            controller.close();
          } catch (err) {
            controller.enqueue(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
            controller.close();
          }
        },
      });

      return new Response(sseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(
        JSON.stringify({ error: 'OpenAI call failed', details: text }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await resp.json().catch(() => ({}));
    const result =
      data?.choices?.[0]?.message?.content ??
      (typeof data === 'string' ? data : JSON.stringify(data));

    return new Response(
      JSON.stringify({ result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('gpt5-mini function error', error);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
