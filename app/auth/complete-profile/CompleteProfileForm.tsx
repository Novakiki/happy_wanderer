'use client';

import { formStyles } from '@/lib/styles';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  userEmail: string;
};

export default function CompleteProfileForm({ userEmail }: Props) {
  const [formData, setFormData] = useState({
    name: '',
    relation: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          relation: formData.relation,
          email: userEmail,
        }),
      });

      if (!response.ok) {
        const { error: apiError } = await response.json();
        setError(apiError || 'Failed to save profile');
        setIsSubmitting(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
          autoFocus
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
        disabled={isSubmitting || !formData.name || !formData.relation}
        className={formStyles.buttonPrimaryFull}
      >
        {isSubmitting ? 'Saving...' : 'Continue'}
      </button>
    </form>
  );
}
