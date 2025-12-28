'use client';

import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  name: string;
  relation?: string;
  editToken?: string;
};

export default function UserMenu({ name, relation, editToken }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-sm"
      >
        <div className="w-7 h-7 rounded-full bg-[#e07a5f]/20 flex items-center justify-center text-[#e07a5f] text-xs font-medium">
          {name.charAt(0).toUpperCase()}
        </div>
        <span className="text-white/80 hidden sm:inline">{name}</span>
        <svg
          className={`w-4 h-4 text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#1a1a1a] border border-white/10 shadow-xl z-20 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-sm text-white font-medium">{name}</p>
              {relation && (
                <p className="text-xs text-white/50">{relation}</p>
              )}
            </div>
            <div className="py-1">
              <Link
                href={editToken ? `/edit/${editToken}` : '/edit'}
                className="group block px-4 py-2 text-left text-sm text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <span>My notes</span>
                <span className="block text-[10px] text-white/30 group-hover:text-white/40 transition-colors">
                  View and edit your contributions
                </span>
              </Link>
              <Link
                href="/people"
                className="group block px-4 py-2 text-left text-sm text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <span>Connections</span>
                <span className="block text-[10px] text-white/30 group-hover:text-white/40 transition-colors">
                  Who you remember, who remembers you
                </span>
              </Link>
              <Link
                href="/settings"
                className="group block px-4 py-2 text-left text-sm text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <span>Settings</span>
              </Link>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full px-4 py-2 text-left text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                {isSigningOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
