'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { href: '/meet', label: 'Hear' },
    { href: '/share', label: 'Keep' },
    { href: '/chapters', label: 'The Score' },
  ];

  return (
    <nav className="bg-white/70 backdrop-blur-md border-b border-black/10 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-serif text-[var(--ink)] tracking-tight">
            The Happy Wanderer
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-6">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors ${
                  pathname === link.href
                    ? 'text-[var(--ink)] font-semibold'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/admin"
              className={`text-xs uppercase tracking-[0.2em] px-3 py-1 rounded-full border transition-colors ${
                pathname === '/admin'
                  ? 'border-[var(--ink)] text-[var(--ink)]'
                  : 'border-black/10 text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              Admin
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="sm:hidden p-2 -mr-2 text-[var(--ink-soft)]"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {isOpen && (
          <div className="sm:hidden mt-4 pb-3 border-t border-black/10 pt-4">
            <div className="flex flex-col gap-2">
              {links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`text-sm py-2 transition-colors ${
                    pathname === link.href ? 'text-[var(--ink)] font-semibold' : 'text-[var(--ink-soft)]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className={`text-xs uppercase tracking-[0.2em] py-2 ${
                  pathname === '/admin' ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'
                }`}
              >
                Admin
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { href: '/meet', label: 'Hear' },
    { href: '/share', label: 'Keep' },
    { href: '/chapters', label: 'The Score' },
  ];

  return (
    <nav className="bg-white/70 backdrop-blur-md border-b border-black/10 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-serif text-[var(--ink)] tracking-tight">
            The Happy Wanderer
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-6">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors ${
                  pathname === link.href
                    ? 'text-[var(--ink)] font-semibold'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/admin"
              className={`text-xs uppercase tracking-[0.2em] px-3 py-1 rounded-full border transition-colors ${
                pathname === '/admin'
                  ? 'border-[var(--ink)] text-[var(--ink)]'
                  : 'border-black/10 text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              Admin
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="sm:hidden p-2 -mr-2 text-[var(--ink-soft)]"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {isOpen && (
          <div className="sm:hidden mt-4 pb-3 border-t border-black/10 pt-4">
            <div className="flex flex-col gap-2">
              {links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`text-sm py-2 transition-colors ${
                    pathname === link.href
                      ? 'text-[var(--ink)] font-semibold'
                      : 'text-[var(--ink-soft)]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className={`text-xs uppercase tracking-[0.2em] py-2 ${
                  pathname === '/admin' ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'
                }`}
              >
                Admin
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
