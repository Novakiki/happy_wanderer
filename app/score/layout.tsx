import Link from 'next/link';
import { cookies } from 'next/headers';
import { SCORE_TITLE } from '@/lib/terminology';
import InteractButton from '@/components/InteractButton';
import EditSessionMenu from '@/components/EditSessionMenu';
import UserMenuClient from '@/components/UserMenuClient';
import DevTools from '@/components/DevTools';

type EditSession = {
  token: string;
  name: string;
};

function readEditSession(value?: string): EditSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    if (parsed && typeof parsed.token === 'string' && typeof parsed.name === 'string') {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export default async function ChaptersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const editSession = readEditSession(cookieStore.get('vals-memory-edit')?.value);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Minimal dark navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-gradient-to-b from-[#0a0a0a] to-transparent">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/score"
            className="text-sm text-white/70 hover:text-white transition-colors font-light tracking-wide"
          >
            {SCORE_TITLE}
          </Link>
          <div className="flex items-center gap-6 text-sm text-white/50">
            <Link href="/share" className="hover:text-white transition-colors">
              Add a note
            </Link>
            <InteractButton />
            {editSession ? (
              <EditSessionMenu name={editSession.name} token={editSession.token} />
            ) : (
              <Link
                href="/edit"
                className="text-white/50 hover:text-white transition-colors"
              >
                Link me
              </Link>
            )}
            <UserMenuClient />
          </div>
        </div>
      </nav>
      {children}
      <DevTools />
    </div>
  );
}
