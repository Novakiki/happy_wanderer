import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formStyles, subtleBackground } from '@/lib/styles';

const TEST_SECRET = process.env.TEST_LOGIN_SECRET;
const ROLEPLAY_ADMIN_EMAIL = process.env.ROLEPLAY_ADMIN_EMAIL || 'mrsamygrant+admin@gmail.com';
const ROLEPLAY_TRUSTED_EMAIL = process.env.ROLEPLAY_TRUSTED_EMAIL || 'mrsamygrant+trusted@gmail.com';
const ROLEPLAY_NEW_EMAIL = process.env.ROLEPLAY_NEW_EMAIL || 'mrsamygrant+new@gmail.com';

const roles = [
  { label: 'Admin', email: ROLEPLAY_ADMIN_EMAIL },
  { label: 'Trusted contributor', email: ROLEPLAY_TRUSTED_EMAIL },
  { label: 'New contributor', email: ROLEPLAY_NEW_EMAIL },
] as const;

function buildLoginLink(email: string) {
  if (!TEST_SECRET) return '#';
  const params = new URLSearchParams({
    secret: TEST_SECRET,
    email,
  });
  return `/api/test/login?${params.toString()}`;
}

export default function TestLoginPage() {
  if (process.env.NODE_ENV === 'production' || !TEST_SECRET) {
    notFound();
  }

  return (
    <div className="min-h-screen text-white bg-[#0b0b0b]" style={subtleBackground}>
      <main className="max-w-xl mx-auto px-6 pt-24 pb-16 space-y-8">
        <header className="space-y-2">
          <p className={formStyles.subLabel}>Dev only</p>
          <h1 className="text-3xl font-serif text-white">Test login</h1>
          <p className="text-white/60">
            Quick roleplay access for local testing. Disabled in production.
          </p>
        </header>

        <section className={formStyles.section}>
          <h2 className="text-lg font-semibold text-white mb-4">Roleplay logins</h2>
          <div className="space-y-3">
            {roles.map((role) => (
              <div
                key={role.email}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="text-sm text-white">{role.label}</p>
                  <p className="text-xs text-white/50">{role.email}</p>
                </div>
                <Link
                  href={buildLoginLink(role.email)}
                  className={formStyles.buttonSecondary}
                >
                  Login
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className={formStyles.section}>
          <p className="text-xs text-white/50">
            Tip: update role emails via `ROLEPLAY_ADMIN_EMAIL`, `ROLEPLAY_TRUSTED_EMAIL`,
            and `ROLEPLAY_NEW_EMAIL` in `.env.local`.
          </p>
        </section>
      </main>
    </div>
  );
}
