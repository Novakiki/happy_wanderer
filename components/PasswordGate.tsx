'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PasswordGate() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.refresh();
      } else {
        setError('That password is incorrect. Please try again.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Warm background gradients matching interior */}
      <div className="pointer-events-none absolute inset-0 bg-[var(--paper)]" />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-[var(--clay)]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-[var(--blush)]/25 blur-3xl" />
      <div className="pointer-events-none absolute left-1/4 -bottom-20 h-64 w-64 rounded-full bg-[var(--sage)]/15 blur-3xl" />

      <div className="relative max-w-md w-full bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg shadow-black/5 border border-[var(--ink-soft)]/10 p-10 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">
          The Happy Wanderer
        </p>
        <h1 className="text-2xl sm:text-3xl font-serif text-[var(--ink)] mb-2 mt-3">
          Family & Friends Access
        </h1>

        {/* Decorative flourish */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="h-px w-8 bg-[var(--clay)]/40" />
          <span className="text-[var(--clay)]/60 text-sm">&#9834;</span>
          <span className="h-px w-8 bg-[var(--clay)]/40" />
        </div>

        <p className="text-[var(--ink-soft)] mb-8 leading-relaxed">
          This is a private space for family and friends to share and explore
          memories of Valerie Park Anderson.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter family password"
              className="w-full px-4 py-3.5 rounded-xl border border-[var(--ink-soft)]/20 bg-white/60 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/40 focus:border-transparent focus:bg-white/80 text-center transition-all placeholder:text-[var(--ink-soft)]/60"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-700/80 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full px-6 py-3.5 bg-[var(--ink)] text-[var(--paper)] rounded-xl hover:bg-[var(--ink)]/90 hover:shadow-md hover:shadow-[var(--clay)]/20 disabled:bg-[var(--ink-soft)]/30 disabled:text-[var(--ink-soft)] disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200"
          >
            {isLoading ? 'Checking...' : 'Enter'}
          </button>
        </form>

        <p className="mt-8 text-sm text-[var(--ink-soft)]">
          If you need the password, please contact a family member.
        </p>
      </div>
    </div>
  );
}
