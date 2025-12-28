'use client';

import { subtleBackground } from '@/lib/styles';
import Link from 'next/link';

export default function TimePage() {
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
          It&apos;s About Time
        </h1>

        <div className="space-y-6 text-white/70 leading-relaxed">
          <p>
            Right now you&apos;re seeing fragments arranged by time — linear storytelling.
          </p>

          <p>
            But memories don&apos;t live that way. They cluster around people, emotions,
            the stories that sparked other stories. Time is the skeleton; what lives
            between the bones is the story.
          </p>

          <h2 className="text-xl font-serif text-white/90 pt-8">Synchronized views — coming soon</h2>

          <p>
            The same fragments can be seen through different lenses:
          </p>

          <ul className="space-y-3 text-white/50">
            <li>
              <span className="text-white/80">By witness</span> — who was present
            </li>
            <li>
              <span className="text-white/80">By storyteller</span> — whose voice
            </li>
            <li>
              <span className="text-white/80">By thread</span> — what sparked what
            </li>
            <li>
              <span className="text-white/80">By meaningful coincidence</span> — patterns that rhyme across time
            </li>
          </ul>

          <p className="pt-4">
            As fragments are regrouped, the people connected to them come into view as well.
          </p>

        </div>
      </div>
    </div>
  );
}
