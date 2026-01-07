'use client';

import { useMemo, useState } from 'react';

import { formStyles } from '@/lib/styles';
import { createClient } from '@/lib/supabase/client';

export default function PasswordSection() {
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message || 'Failed to update password.');
    } else {
      setSuccess('Password updated.');
      setPassword('');
      setConfirmPassword('');
    }

    setSaving(false);
  };

  return (
    <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-white/80 mb-1">Password</h2>
          <p className="text-xs text-white/50">Update your password</p>
        </div>
        {success && <span className="text-xs text-green-400">{success}</span>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 mt-4">
        <div className="space-y-2">
          <label htmlFor="new-password" className="text-xs text-white/60">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            className={formStyles.inputSmall}
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm-password" className="text-xs text-white/60">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            className={formStyles.inputSmall}
            placeholder="Type it again"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className={formStyles.error}>{error}</p>}

        <button
          type="submit"
          disabled={saving || !password || !confirmPassword}
          className="text-xs px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:bg-white/5 disabled:text-white/50 transition-colors"
        >
          {saving ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
