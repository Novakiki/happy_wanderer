'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formStyles } from '@/lib/styles';

type RequestState = 'idle' | 'loading' | 'sent' | 'error';

export default function EditRequestForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<RequestState>('idle');
  const [error, setError] = useState('');
  const [devLink, setDevLink] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setDevLink(null);
    setState('loading');

    try {
      const response = await fetch('/api/edit/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Request failed');
      }

      setDevLink(payload?.devLink || null);
      setState('sent');
    } catch (err) {
      console.error(err);
      setError('We could not send the link. Please try again.');
      setState('error');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`max-w-xl w-full space-y-4 ${formStyles.section}`}
    >
      <div>
        <label htmlFor="edit-email" className={formStyles.label}>
          Email used on your note
        </label>
        <input
          id="edit-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={formStyles.input}
          required
        />
      </div>

      {state === 'sent' && (
        <p className={formStyles.success}>
          If that email matches a note, we sent a magic link to edit your submissions.
        </p>
      )}

      {devLink && (
        <div className="text-xs text-white/50 break-all">
          Dev link: <a href={devLink} className={formStyles.buttonGhost}>{devLink}</a>
        </div>
      )}

      {error && <p className={formStyles.error}>{error}</p>}

      <button
        type="submit"
        disabled={state === 'loading' || !email.trim()}
        className={formStyles.buttonPrimaryFull}
      >
        {state === 'loading' ? 'Sending...' : 'Send magic link'}
      </button>

      <p className="text-sm text-white/60">
        Already have a password?{' '}
        <Link
          href={`/auth/login${email ? `?email=${encodeURIComponent(email)}` : ''}`}
          className="text-[#e07a5f] hover:text-white transition-colors"
        >
          Sign in instead
        </Link>
        .
      </p>
    </form>
  );
}
