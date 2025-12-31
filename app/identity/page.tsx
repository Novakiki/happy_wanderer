import Link from 'next/link';
import { immersiveBackground } from '@/lib/styles';

export const metadata = {
  title: 'How Identity Works',
};

export default function IdentityPage() {
  return (
    <div className="min-h-screen text-white bg-[#0b0b0b]" style={immersiveBackground}>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-8">
          Privacy & Consent
        </p>

        <h1 className="text-2xl font-serif text-white mb-8">
          How Identity Works
        </h1>

        <div className="space-y-6 text-white/70 leading-relaxed">
          <p>
            Stories about a life often involve other people. Some may want to be
            named; others may prefer not to appear at all. This system respects
            that difference.
          </p>

          <p>
            When someone is mentioned in a memory, their name does not
            automatically become public. Instead, it remains private until they
            choose otherwise.
          </p>

          {/* Visibility Options */}
          <div className="mt-10 mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-4">
              Visibility Options
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <span className="text-white/30 font-mono text-sm w-12">Full</span>
                <div>
                  <p className="text-white">Sarah Mitchell</p>
                  <p className="text-sm text-white/50">Your name appears as written</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-white/30 font-mono text-sm w-12">Init.</span>
                <div>
                  <p className="text-white">S.M.</p>
                  <p className="text-sm text-white/50">Shows first letters only</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-white/30 font-mono text-sm w-12">Rel.</span>
                <div>
                  <p className="text-white">a cousin</p>
                  <p className="text-sm text-white/50">Shows how you knew them</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-white/30 font-mono text-sm w-12">Hide</span>
                <div>
                  <p className="text-white/60 italic">someone</p>
                  <p className="text-sm text-white/50">Appears as &ldquo;someone&rdquo;</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-white">
            Why some names appear differently
          </p>

          <p>
            If you see a name shown as initials, a relationship, or simply
            &ldquo;someone,&rdquo; it means that person has chosen how they want
            to appear&mdash;or hasn&apos;t yet made a choice.
          </p>

          <p>
            This is intentional. Identity disclosure is opt-in, not automatic.
            Each person controls their own visibility, and that control extends
            to each story where they appear.
          </p>

          <p className="text-white mt-10">
            For contributors
          </p>

          <p>
            When you share a memory, you can set a default visibility preference
            in your{' '}
            <Link
              href="/settings"
              className="text-[#e07a5f] hover:text-white transition-colors underline underline-offset-4"
            >
              settings
            </Link>
            . This determines how your name appears across the site unless you
            choose differently for a specific story.
          </p>

          <p>
            You can also adjust visibility per-story if you want to appear
            differently in different contexts.
          </p>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10">
          <Link
            href="/"
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            &larr; Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
