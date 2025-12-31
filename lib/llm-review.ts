import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export type LlmReviewInput = {
  title?: string;
  content: string;
  why?: string;
};

export type LlmReviewResult = {
  approve: boolean;
  reasons: string[];
};

const FUNCTION_URL = (supabaseUrl: string) => {
  const url = new URL(supabaseUrl);
  const host = url.hostname.replace('.supabase.co', '.functions.supabase.co');
  return `${url.protocol}//${host}/gpt5-mini`;
};

const buildPrompt = (input: LlmReviewInput) => {
  const title = input.title?.trim() || '(none)';
  const content = input.content;
  const why = input.why?.trim() || '(none)';

  return [
    'You are an approval gate for publishing family memory text.',
    'Decide if it is safe to publish based on privacy/sensitivity.',
    'Reject if it contains: phone/email/addresses, sensitive medical or financial details, minors + explicit content, slurs/hate, or clearly identifying third parties without consent.',
    'Otherwise approve.',
    'Respond ONLY in JSON with shape: {"approve": true|false, "reasons": ["..."]}.',
    `Title: ${title}`,
    `Content: ${content}`,
    `Why: ${why}`,
  ].join('\n');
};

const getAuthToken = async () => {
  const functionSecret = process.env.LLM_FUNCTION_SECRET;
  if (functionSecret) {
    return functionSecret;
  }

  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      return data.session.access_token;
    }
  } catch (err) {
    console.warn('llm-review: session lookup failed', err);
  }

  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || null
  );
};

const parseLlmResponse = (raw: unknown): LlmReviewResult => {
  let parsed: { approve?: boolean; reasons?: string[] } = {};

  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
  } else if (raw && typeof raw === 'object') {
    parsed = raw as typeof parsed;
  }

  const approve = Boolean(parsed.approve);
  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons.map((reason) => String(reason))
    : [];

  if (!approve && reasons.length === 0) {
    return {
      approve: false,
      reasons: ['LLM review did not approve this submission.'],
    };
  }

  return { approve, reasons };
};

export async function runLlmReview(input: LlmReviewInput): Promise<LlmReviewResult> {
  if (!input.content?.trim()) {
    return { approve: false, reasons: ['Missing content.'] };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL');
  }

  const token = await getAuthToken();
  if (!token) {
    throw new Error('Missing auth token');
  }

  const prompt = buildPrompt(input);

  const resp = await fetch(FUNCTION_URL(supabaseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, stream: false }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LLM call failed: ${text}`);
  }

  const data = await resp.json().catch(() => ({}));
  const raw = (data as { result?: unknown }).result ?? data;
  return parseLlmResponse(raw);
}

type LlmGateSuccess = {
  ok: true;
  result: LlmReviewResult;
};

type LlmGateError = {
  ok: false;
  response: NextResponse;
};

export type LlmGateResult = LlmGateSuccess | LlmGateError;

/**
 * Wrapper that handles LLM review with standard error responses.
 * Returns { ok: true, result } on success, or { ok: false, response } with
 * a ready-to-return NextResponse on failure.
 *
 * @param input - The content to review
 * @param errorMessage - Custom error message for rejected content (default: "LLM review blocked submission.")
 */
export async function llmReviewGate(
  input: LlmReviewInput,
  errorMessage = 'LLM review blocked submission.'
): Promise<LlmGateResult> {
  let result: LlmReviewResult;

  try {
    result = await runLlmReview(input);
  } catch (err) {
    console.error('LLM review error:', err);
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'LLM review unavailable. Please try again.' },
        { status: 503 }
      ),
    };
  }

  if (!result.approve) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: errorMessage, reasons: result.reasons },
        { status: 422 }
      ),
    };
  }

  return { ok: true, result };
}
