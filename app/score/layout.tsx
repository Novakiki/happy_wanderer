import Link from 'next/link';
import { cookies } from 'next/headers';
import InteractButton from '@/components/InteractButton';
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
      {/* Unified header - aligned with hero content */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-3 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/95 to-transparent">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Brand anchor with icon + label */}
          <Link
            href="/score"
            className="group flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors"
            aria-label="Happy Wanderer - Return to score"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-70 group-hover:opacity-100 transition-opacity"
            >
              <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
            </svg>
            <span className="text-xs tracking-[0.15em] uppercase font-light">Happy Wanderer</span>
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
