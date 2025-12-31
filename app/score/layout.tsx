import Link from 'next/link';
import { cookies } from 'next/headers';
import InteractButton from '@/components/InteractButton';
import UserMenuClient from '@/components/UserMenuClient';
import DevTools from '@/components/DevTools';
import { readEditSession } from '@/lib/edit-session';

export default async function ChaptersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const editSession = readEditSession(cookieStore.get('vals-memory-edit')?.value);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Unified header - aligned with hero content */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-3 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/95 to-transparent">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Home anchor */}
          <Link
            href="/score"
            className="text-white/50 hover:text-white/80 transition-colors p-2 -m-2"
            aria-label="Return to score"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
            </svg>
          </Link>
          {/* Nav items */}
          <div className="flex items-center gap-5 text-xs text-white/40">
            <Link href="/share" className="hover:text-white/70 transition-colors tracking-wide">
              Add a note
            </Link>
            <InteractButton />
            <UserMenuClient editToken={editSession?.token} />
          </div>
        </div>
      </nav>
      {children}
      <DevTools />
    </div>
  );
}
