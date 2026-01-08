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

type PiiScanResult = { ok: true } | { ok: false; reasons: string[] };

const FUNCTION_URL = (supabaseUrl: string) => {
  const url = new URL(supabaseUrl);
  const host = url.hostname.replace('.supabase.co', '.functions.supabase.co');
  return `${url.protocol}//${host}/gpt5-mini`;
};

function scanForDisallowedPii(input: LlmReviewInput): PiiScanResult {
  const text = `${input.title ?? ''}\n${input.why ?? ''}\n${input.content ?? ''}`;
  const reasons: string[] = [];

  // Email addresses
  const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  if (emailRegex.test(text)) {
    reasons.push('Contains an email address.');
  }

  // Phone numbers (US-ish + international-ish). Intentionally broad; false positives are OK (fail-closed).
  // Examples matched: (555) 123-4567, 555-123-4567, +1 555 123 4567, 5551234567
  const phoneRegex =
    /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(\s*\d{3}\s*\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/;
  if (phoneRegex.test(text)) {
    reasons.push('Contains a phone number.');
  }

  // Physical addresses (very heuristic): number + street name + common suffix.
  const addressRegex =
    /\b\d{1,6}\s+[A-Z0-9.'-]+(?:\s+[A-Z0-9.'-]+){0,4}\s+(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|cir|circle|way|pl|place|trl|trail)\b/i;
  if (addressRegex.test(text)) {
    reasons.push('Contains a physical address.');
  }

  return reasons.length > 0 ? { ok: false, reasons } : { ok: true };
}

const buildPrompt = (input: LlmReviewInput) => {
  const title = input.title?.trim() || '(none)';
  const content = input.content;
  const why = input.why?.trim() || '(none)';

  return [
    'You are an approval gate for publishing family memory text.',
    'Decide if it is safe to publish based on privacy/sensitivity.',
    'Reject if it contains: phone numbers, email addresses, physical addresses, sensitive medical or financial details, minors + explicit content, or slurs/hate speech.',
    'Handle person names with consent rules:',
    '- Always allow and never flag Valerie Park Anderson and her variants: Val, Valerie, Valeri, Valera, Valeria, Valerie Anderson, Valerie Park Anderson.',
    '- Only treat a name as a public figure if you are EXTREMELY confident it is a widely-known real person (actors, presidents, major historical figures). If you are unsure, treat it as a private individual.',
    '- Do NOT block fictional characters; they can remain as plain text and must NOT create person records.',
    '- For any other person name (likely family/relative/private individual), require consent: return approve=false with reason "Needs consent for named person."',
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

  // Test / CI escape hatch: allow running E2E flows without making external LLM calls.
  // This preserves the production safety gate while keeping automated tests deterministic
  // (and avoiding token usage) when explicitly enabled.
  if (process.env.SKIP_LLM_REVIEW === 'true') {
    return { approve: true, reasons: [] };
  }

  // Deterministic preflight checks (no LLM call).
  const piiScan = scanForDisallowedPii(input);
  if (!piiScan.ok) {
    return { approve: false, reasons: piiScan.reasons };
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
