'use client';

import { useState } from 'react';
import { formStyles } from '@/lib/styles';

type TrustRequestStatus = 'pending' | 'approved' | 'declined' | null;

type Props = {
  isTrusted: boolean;
  status?: TrustRequestStatus;
};

const MAX_MESSAGE_LENGTH = 400;

export default function TrustRequestPanel({ isTrusted, status = null }: Props) {
  const [requestStatus, setRequestStatus] = useState<TrustRequestStatus>(status);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (isTrusted) return null;

  const isPending = requestStatus === 'pending';
  const wasDeclined = requestStatus === 'declined';

  const submitRequest = async () => {
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/trust-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim() ? message.trim().slice(0, MAX_MESSAGE_LENGTH) : null,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result?.error || 'Could not submit request.');
        return;
      }
      setRequestStatus('pending');
    } catch (err) {
      console.error(err);
      setError('Could not submit request.');
    } finally {
      setBusy(false);
    }
  };

  if (isPending) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 text-left">
        <p className="text-sm font-medium text-white mb-2">Trusted status request received</p>
        <p className="text-sm text-white/60">
          We&apos;ll review this and update your status soon.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 text-left space-y-3">
      <div>
        <p className="text-sm font-medium text-white">Request trusted status</p>
        <p className="text-sm text-white/60 mt-1">
          Trusted contributors have their Notes publish right away. If you&apos;d like that, request it here.
        </p>
        {wasDeclined && (
          <p className="text-xs text-white/50 mt-2">
            A previous request was declined. You can still request again.
          </p>
        )}
      </div>

      <div>
        <label className={formStyles.label}>Optional note</label>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Share anything that helps us understand your request."
          className={formStyles.textarea}
        />
        <p className="text-xs text-white/40 mt-2">
          {message.length}/{MAX_MESSAGE_LENGTH}
        </p>
      </div>

      {error && <p className={formStyles.error}>{error}</p>}

      <button
        type="button"
        onClick={submitRequest}
        disabled={busy}
        className={formStyles.buttonPrimary}
      >
        {busy ? 'Submitting...' : 'Request trusted status'}
      </button>
    </div>
  );
}
