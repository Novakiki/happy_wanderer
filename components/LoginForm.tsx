'use client';

import { formStyles } from '@/lib/styles';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [method, setMethod] = useState<'password' | 'magic'>('password');
  const [step, setStep] = useState<'form' | 'check-email' | 'reset-sent'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (method === 'password') {
        // Sign in with password
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          if (authError.message.includes('Invalid login credentials')) {
            setError('Invalid email or password');
          } else {
            setError(authError.message);
          }
          setIsSubmitting(false);
          return;
        }

        // Successful password login - redirect
        router.push('/score');
        router.refresh();
      } else {
        // Magic link
        const { error: authError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (authError) {
          setError(authError.message);
          setIsSubmitting(false);
          return;
        }

        setStep('check-email');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email first');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        setIsSubmitting(false);
        return;
      }

      setStep('reset-sent');
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'check-email') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#e07a5f]/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#e07a5f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-serif text-white mb-3">Check your email</h2>
        <p className="text-white/60 mb-6">
          We sent a magic link to <span className="text-white">{email}</span>.
          <br />Click the link to sign in.
        </p>
        <button
          onClick={() => setStep('form')}
          className={formStyles.buttonGhost}
        >
          Use a different email
        </button>
      </div>
    );
  }

  if (step === 'reset-sent') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#e07a5f]/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#e07a5f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h2 className="text-2xl font-serif text-white mb-3">Check your email</h2>
        <p className="text-white/60 mb-6">
          We sent a password reset link to <span className="text-white">{email}</span>.
          <br />Click the link to set a new password.
        </p>
        <button
          onClick={() => setStep('form')}
          className={formStyles.buttonGhost}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
      suppressHydrationWarning
    >
      <div>
        <label htmlFor="email" className={formStyles.label}>
          Email
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={formStyles.input}
          autoComplete="email"
          suppressHydrationWarning
          required
          autoFocus
        />
      </div>

      {method === 'password' && (
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className={formStyles.label}>
              Password
            </label>
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={isSubmitting}
              className="text-xs text-[#e07a5f] hover:text-[#d06a4f] transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className={formStyles.input}
            autoComplete="current-password"
            suppressHydrationWarning
            required
          />
        </div>
      )}

      {error && <p className={formStyles.error}>{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || !email || (method === 'password' && !password)}
        className={formStyles.buttonPrimaryFull}
      >
        {isSubmitting ? 'Signing in...' : method === 'password' ? 'Sign in' : 'Send magic link'}
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            setMethod(method === 'password' ? 'magic' : 'password');
            setError('');
          }}
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          {method === 'password' ? 'Use magic link instead' : 'Use password instead'}
        </button>
      </div>

      <p className="text-center text-sm text-white/50">
        Don&apos;t have an account?{' '}
        <a href="/auth/signup" className={formStyles.buttonGhost}>
          Sign up
        </a>
      </p>
    </form>
  );
}
