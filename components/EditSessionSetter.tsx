'use client';

import { useEffect } from 'react';

export default function EditSessionSetter({ token }: { token: string }) {
  useEffect(() => {
    if (!token) return;
    fetch('/api/edit/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => {
      // Non-blocking: session badge is optional.
    });
  }, [token]);

  return null;
}
