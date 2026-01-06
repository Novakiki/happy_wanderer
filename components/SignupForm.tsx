'use client';

import { formStyles } from '@/lib/styles';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function SignupForm() {
  const [formData, setFormData] = useState({
    inviteCode: '',
    email: '',
    password: '',
    name: '',
    relation: '',
  });
  const [codeFromUrl, setCodeFromUrl] = useState('');
  const [step, setStep] = useState<'form' | 'check-email' | 'success'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  // If the user arrives via an invite link like `/auth/signup?code=...`, prefill the code.
  // Keep the field editable in case they need to correct it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get('code') ?? '').trim();
    if (!code) return;

    setCodeFromUrl(code);
    setFormData((prev) => {
      if (prev.inviteCode.trim()) return prev;
      return { ...prev, inviteCode: code };
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Validate invite code first
      const codeResponse = await fetch('/api/auth/validate-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: formData.inviteCode }),
      });

      if (!codeResponse.ok) {
        const { error: codeError } = await codeResponse.json();
        setError(codeError || 'Invalid invite code');
        setIsSubmitting(false);
        return;
      }

      // If password provided, sign up with password
      if (formData.password) {
        const { error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              name: formData.name,
              relation: formData.relation,
            },
          },
        });

        if (authError) {
          setError(authError.message);
          setIsSubmitting(false);
          return;
        }

        setStep('check-email');
      } else {
        // No password - use magic link
        const { error: authError } = await supabase.auth.signInWithOtp({
          email: formData.email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              name: formData.name,
              relation: formData.relation,
            },
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
          We sent a {formData.password ? 'confirmation link' : 'magic link'} to <span className="text-white">{formData.email}</span>.
          <br />Click the link to complete your registration.
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="inviteCode" className={formStyles.label}>
          Family invite code <span className={formStyles.required}>*</span>
        </label>
        <p className={formStyles.hint}>
          {codeFromUrl ? "This link prefilled your code. You can edit it if needed." : 'Ask a family member for the code'}
        </p>
        <input
          type="text"
          id="inviteCode"
          value={formData.inviteCode}
          onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value })}
          placeholder="Enter invite code"
          className={`${formStyles.input} mt-2`}
          required
        />
      </div>

      <div>
        <label htmlFor="email" className={formStyles.label}>
          Email <span className={formStyles.required}>*</span>
        </label>
        <input
          type="email"
          id="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="you@example.com"
          className={formStyles.input}
          required
        />
      </div>

      <div>
        <label htmlFor="password" className={formStyles.label}>
          Password <span className="text-white/50 text-xs font-normal">(optional)</span>
        </label>
        <p className={formStyles.hint}>Set a password for faster login, or leave blank to use magic link</p>
        <input
          type="password"
          id="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder="At least 6 characters"
          className={`${formStyles.input} mt-2`}
          minLength={6}
        />
      </div>

      <div>
        <label htmlFor="name" className={formStyles.label}>
          Your name <span className={formStyles.required}>*</span>
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Sarah"
          className={formStyles.input}
          required
        />
      </div>

      <div>
        <label htmlFor="relation" className={formStyles.label}>
          Relationship to Val <span className={formStyles.required}>*</span>
        </label>
        <input
          type="text"
          id="relation"
          value={formData.relation}
          onChange={(e) => setFormData({ ...formData, relation: e.target.value })}
          placeholder="e.g., cousin, friend, neighbor"
          className={formStyles.input}
          required
        />
      </div>

      {error && <p className={formStyles.error}>{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || !formData.inviteCode || !formData.email || !formData.name || !formData.relation}
        className={formStyles.buttonPrimaryFull}
      >
        {isSubmitting ? 'Creating account...' : formData.password ? 'Create account' : 'Continue with magic link'}
      </button>

      <p className="text-center text-sm text-white/50">
        Already have an account?{' '}
        <a href="/auth/login" className={formStyles.buttonGhost}>
          Sign in
        </a>
      </p>
    </form>
  );
}
