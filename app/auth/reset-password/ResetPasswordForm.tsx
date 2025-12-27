'use client';

import { formStyles } from '@/lib/styles';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);

      // Redirect to score after a moment
      setTimeout(() => {
        router.push('/score');
        router.refresh();
      }, 2000);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-serif text-white mb-3">Password updated</h2>
        <p className="text-white/60">
          Redirecting you now...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="password" className={formStyles.label}>
          New password
        </label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          className={formStyles.input}
          required
          minLength={6}
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className={formStyles.label}>
          Confirm password
        </label>
        <input
          type="password"
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Type it again"
          className={formStyles.input}
          required
        />
      </div>

      {error && <p className={formStyles.error}>{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || !password || !confirmPassword}
        className={formStyles.buttonPrimaryFull}
      >
        {isSubmitting ? 'Updating...' : 'Set new password'}
      </button>

      <p className="text-center text-sm text-white/50">
        <a href="/auth/login" className={formStyles.buttonGhost}>
          Back to sign in
        </a>
      </p>
    </form>
  );
}
