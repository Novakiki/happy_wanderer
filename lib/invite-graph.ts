import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { INVITE_MAX_DEPTH, INVITE_MAX_USES } from '@/lib/invites';

type ParentInviteRow = {
  id: string;
  depth: number | null;
  status: string | null;
  expires_at: string | null;
};

export type InviteGraphContext = {
  parent_invite_id: string | null;
  depth: number;
  max_uses: number;
};

const INVITE_ALLOWED_STATUS = new Set(['pending', 'sent', 'opened', 'clicked', 'contributed']);

export async function resolveInviteGraphContext(
  admin: SupabaseClient<Database>,
  parentInviteId?: string | null
) {
  if (!parentInviteId) {
    return {
      ok: true as const,
      context: {
        parent_invite_id: null,
        depth: 0,
        max_uses: INVITE_MAX_USES,
      },
    };
  }

  const { data, error } = await admin
    .from('invites')
    .select('id, depth, status, expires_at')
    .eq('id', parentInviteId)
    .single();

  if (error || !data) {
    return { ok: false as const, error: 'Parent invite not found.' };
  }

  const parent = data as ParentInviteRow;
  if (parent.status && !INVITE_ALLOWED_STATUS.has(parent.status)) {
    return { ok: false as const, error: 'Parent invite is no longer active.' };
  }

  if (parent.expires_at && new Date(parent.expires_at) < new Date()) {
    return { ok: false as const, error: 'Parent invite has expired.' };
  }

  const parentDepth = parent.depth ?? 0;
  if (parentDepth >= INVITE_MAX_DEPTH) {
    return { ok: false as const, error: 'Invite chain limit reached.' };
  }

  return {
    ok: true as const,
    context: {
      parent_invite_id: parentInviteId,
      depth: parentDepth + 1,
      max_uses: INVITE_MAX_USES,
    },
  };
}
