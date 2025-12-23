import Link from 'next/link';

export default function ChaptersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Minimal dark navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-gradient-to-b from-[#0a0a0a] to-transparent">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/chapters"
            className="text-sm text-white/70 hover:text-white transition-colors font-light tracking-wide"
          >
            The Happy Wanderer
          </Link>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <Link href="/about" className="hover:text-white/70 transition-colors">
              About
            </Link>
            <Link href="/admin" className="hover:text-white/70 transition-colors">
              Admin
            </Link>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
