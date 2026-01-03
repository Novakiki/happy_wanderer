export const INVITE_COOKIE_NAME = 'vals-memory-invite';
export const INVITE_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const INVITE_SESSION_VERSION = 2;

type InviteSessionPayload = {
  v: number;
  invite_id: string;
  invite_hash: string;
  issued_at: number;
  expires_at: number;
  scope: 'browse';
  session_id: string;
};

const encoder = new TextEncoder();

function toBase64Url(base64: string) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(base64url: string) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = base64.length % 4;
  return base64 + (padLength ? '='.repeat(4 - padLength) : '');
}

function base64UrlEncodeString(input: string) {
  if (typeof Buffer !== 'undefined') {
    return toBase64Url(Buffer.from(input, 'utf-8').toString('base64'));
  }
  return toBase64Url(btoa(input));
}

function base64UrlDecodeToString(input: string) {
  const base64 = fromBase64Url(input);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf-8');
  }
  return atob(base64);
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  if (typeof Buffer !== 'undefined') {
    return toBase64Url(Buffer.from(bytes).toString('base64'));
  }
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return toBase64Url(btoa(binary));
}

async function signWithSecret(secret: string, payload: string) {
  if (!secret) return null;
  if (!globalThis.crypto?.subtle) return null;
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function getInviteCookieSecret() {
  return process.env.INVITE_COOKIE_SECRET || process.env.SUPABASE_SECRET_KEY || '';
}

export async function hashInviteId(inviteId: string) {
  const secret = getInviteCookieSecret();
  return await signWithSecret(secret, inviteId);
}

export async function createInviteSessionCookie(inviteId: string) {
  const secret = getInviteCookieSecret();
  if (!secret) return null;
  const inviteHash = await hashInviteId(inviteId);
  if (!inviteHash) return null;

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + INVITE_COOKIE_TTL_SECONDS;
  const payload: InviteSessionPayload = {
    v: INVITE_SESSION_VERSION,
    invite_id: inviteId,
    invite_hash: inviteHash,
    issued_at: issuedAt,
    expires_at: expiresAt,
    scope: 'browse',
    session_id: globalThis.crypto?.randomUUID?.() || `${issuedAt}`,
  };

  const encodedPayload = base64UrlEncodeString(JSON.stringify(payload));
  const signature = await signWithSecret(secret, encodedPayload);
  if (!signature) return null;
  return `${encodedPayload}.${signature}`;
}

export async function readInviteSession(cookieValue?: string) {
  if (!cookieValue) return null;
  const [encodedPayload, signature] = cookieValue.split('.');
  if (!encodedPayload || !signature) return null;

  const secret = getInviteCookieSecret();
  if (!secret) return null;

  const expectedSignature = await signWithSecret(secret, encodedPayload);
  if (!expectedSignature || expectedSignature !== signature) return null;

  let payload: InviteSessionPayload | null = null;
  try {
    payload = JSON.parse(base64UrlDecodeToString(encodedPayload)) as InviteSessionPayload;
  } catch {
    return null;
  }

  if (!payload || payload.v !== INVITE_SESSION_VERSION) return null;
  if (!payload.invite_id) return null;
  if (payload.scope !== 'browse') return null;
  if (!payload.expires_at || payload.expires_at < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

export async function inviteSessionMatchesInvite(session: InviteSessionPayload | null, inviteId: string) {
  if (!session) return false;
  if (session.invite_id && session.invite_id !== inviteId) return false;
  const inviteHash = await hashInviteId(inviteId);
  if (!inviteHash) return false;
  return session.invite_hash === inviteHash;
}

type InviteAccessRow = {
  id: string;
  status: string | null;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number | null;
};

const INVITE_ALLOWED_STATUS = new Set(['pending', 'sent', 'opened', 'clicked', 'contributed']);

function isInviteActive(invite: InviteAccessRow) {
  if (!invite) return false;
  if (invite.status && !INVITE_ALLOWED_STATUS.has(invite.status)) return false;
  return true;
}

async function fetchInviteAccess(inviteId: string): Promise<InviteAccessRow | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  const url = new URL(`${supabaseUrl}/rest/v1/invites`);
  url.searchParams.set('select', 'id,status,expires_at,max_uses,uses_count');
  url.searchParams.set('id', `eq.${inviteId}`);

  const resp = await fetch(url.toString(), {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!resp.ok) return null;
  const data = await resp.json().catch(() => []);
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as InviteAccessRow;
}

export async function validateInviteSession(cookieValue?: string) {
  const session = await readInviteSession(cookieValue);
  if (!session?.invite_id) return null;
  const invite = await fetchInviteAccess(session.invite_id);
  if (!invite || !isInviteActive(invite)) return null;
  return { session, invite };
}
