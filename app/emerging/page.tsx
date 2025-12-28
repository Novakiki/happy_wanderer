'use client';

import { subtleBackground } from '@/lib/styles';
import Link from 'next/link';

export default function EmergingPage() {
  return (
    <div
      className="min-h-screen text-white"
      style={subtleBackground}
    >
      <div className="max-w-2xl mx-auto px-6 py-24">
        <Link
          href="/score"
          className="text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white/60 transition-colors"
        >
          &larr; Back to the score
        </Link>

        <h1 className="text-3xl sm:text-4xl font-serif text-white/95 mt-8 mb-12">
          What&apos;s Emerging
        </h1>

        <div className="space-y-6 text-white/70 leading-relaxed">
          <p>
            This space is built around shared context.
          </p>

          <p>
            Restoring that context can allow reconnection to emerge—not only around one
            person, but across siblings, cousins, and extended family who shared a life together.
          </p>

          <p className="text-white/50 italic pt-4">
            In this sense, connection is the inheritance.
          </p>
        </div>
      </div>
    </div>
  );
}
