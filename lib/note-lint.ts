import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { stripHtml } from '@/lib/html-utils';

export type LintWarning = {
  code: string;
  message: string;
  suggestion?: string;
  severity?: 'soft' | 'strong';
  match?: string;
};

export async function lintNote(
  admin: SupabaseClient<Database>,
  content: string
): Promise<LintWarning[]> {
  const noteBody = stripHtml(content || '').trim();
  if (!noteBody) {
    return [];
  }

  const { data, error } = await ((admin as any).rpc('lint_note', { note_body: noteBody }) as Promise<{
    data: unknown;
    error: { message?: string } | null;
  }>);

  if (error) {
    console.warn('lint_note RPC failed', error);
    return [];
  }

  return Array.isArray(data) ? (data as LintWarning[]) : [];
}
