'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Props = {
  name: string;
  token?: string;
};

export default function EditSessionMenu({ name, token }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full border border-white/15 px-3 py-1 text-white/70 text-xs hover:border-white/30 hover:text-white transition-colors"
      >
        Your notes
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-xl border border-white/10 bg-black/80 backdrop-blur-md shadow-lg shadow-black/40">
          <div className="px-3 py-2 border-b border-white/10 text-xs text-white/50">
            Linked as {name}
          </div>
          <Link
            href={token ? `/edit/${token}` : '/edit'}
            className="block px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/5 rounded-t-xl transition-colors"
          >
            Your notes
          </Link>
        </div>
      )}
    </div>
  );
}
