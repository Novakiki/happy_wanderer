'use client';

import Link from 'next/link';
import { subtleBackground } from '@/lib/styles';

export default function SettingsPage() {
  return (
    <div className="min-h-screen text-white" style={subtleBackground}>
      <div className="max-w-xl mx-auto px-6 py-24">
        <Link
          href="/score"
          className="text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white/60 transition-colors"
        >
          &larr; Back to the score
        </Link>

        <h1 className="text-2xl font-light text-white/90 mt-8 mb-8">
          Settings
        </h1>

        <div className="space-y-6">
          {/* Password */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <h2 className="text-sm font-medium text-white/80 mb-1">Password</h2>
            <p className="text-xs text-white/40 mb-3">Update your password</p>
            <button
              disabled
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/30 cursor-not-allowed"
            >
              Coming soon
            </button>
          </div>

          {/* Relationship */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <h2 className="text-sm font-medium text-white/80 mb-1">Relationship</h2>
            <p className="text-xs text-white/40 mb-3">How you knew Val</p>
            <button
              disabled
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/30 cursor-not-allowed"
            >
              Coming soon
            </button>
          </div>

          {/* Notifications */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <h2 className="text-sm font-medium text-white/80 mb-1">Notifications</h2>
            <p className="text-xs text-white/40 mb-3">Email preferences for new notes and responses</p>
            <button
              disabled
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/30 cursor-not-allowed"
            >
              Coming soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
