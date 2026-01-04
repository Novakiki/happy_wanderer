'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import { formStyles, subtleBackground } from '@/lib/styles';

export default function DisabledAccountPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const signOut = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Could not sign out.');
        return;
      }
      router.replace('/auth/login');
    } catch (err) {
      console.error(err);
      setError('Could not sign out.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen text-white bg-[#0b0b0b]" style={subtleBackground}>
      <Nav
        userProfile={{
          name: 'Account paused',
          relation: '',
          email: '',
          contributorId: '',
        }}
      />

      <main className="max-w-xl mx-auto px-6 pt-24 pb-20">
        <div className={formStyles.section}>
          <h1 className="text-2xl font-serif text-white mb-2">This account is paused</h1>
          <p className="text-sm text-white/70">
            An admin has paused this account’s access to Happy Wanderer. If you think this is a mistake,
            please reach out to the family coordinator.
          </p>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              className={formStyles.buttonSecondary}
              onClick={signOut}
              disabled={busy}
            >
              Sign out
            </button>
          </div>

          {error && <p className={`${formStyles.error} mt-3`}>{error}</p>}
        </div>
      </main>
    </div>
  );
}

