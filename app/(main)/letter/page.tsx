import Link from "next/link";

export default function LetterPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors mb-12"
        >
          &larr; Back
        </Link>

        <article className="prose prose-slate max-w-none">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)] mb-8">
            A letter to her children
          </p>

          <div className="space-y-6 text-[var(--ink-soft)] leading-relaxed">
            <p className="text-[var(--ink)]">
              You did not lose your mother all at once.
            </p>

            <p>
              What was taken followed a sequence: first, coordination and timing;
              then the ability to explain herself; and eventually the capacity to
              shape how others understood who she was. Her illness made her
              progressively unavailable as herself. In narrative terms, this is
              not simple absence. It is interrupted transmission.
            </p>

            <p>
              At a biological level, speech depends on timing, sequencing, and
              coordinated movement. When those systems weaken, expression becomes
              fragmented or inaccessible.
            </p>

            <p>
              That same dependency appears at a human level. A person&apos;s self-story
              is built from similar patterns, but carried through lived action.
              Before someone can tell who they are, they have already shown
              it&mdash;through choices, habits, relationships, and through timing
              itself: how they responded, how they noticed what mattered, how they
              moved through ordinary moments. A life unfolds less like a single
              story and more like a piece of music, learned by hearing its rhythm
              and harmony across many notes.
            </p>

            <div className="border-l-2 border-[var(--clay)]/40 pl-6 my-8">
              <p className="text-[var(--ink)]">
                Below is my attempt to restore some of these patterns&mdash;to give
                back to your mother something that Huntington&apos;s stole: the ability
                for her children to know her.
              </p>
            </div>

            <p>
              Each story restores something specific. One returns her humor.
              Another brings back her judgment or her care. Another restores how
              she made decisions, how she noticed what mattered, how she moved
              through ordinary moments with intention. On their own, these pieces
              are incomplete. But when they are gathered, they begin to move
              together.
            </p>

            <p>
              What&apos;s being collected here isn&apos;t just memory. It&apos;s pattern.
              Timing. A way of being that once lived easily in her body and voice,
              and later had to travel more quietly. Like notes held by different
              instruments, or steps remembered by different dancers, these
              fragments carry parts of the same original motion. Together, they
              help restore the feel of her presence&mdash;not perfectly, not all at
              once, but enough to recognize the dance she was already dancing.
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-black/10">
            <p className="text-[var(--ink-soft)] italic">
              You can come back to this space again and again&mdash;as you grow
              older, as your life changes, as new questions appear. Your
              relationship to your mother doesn&apos;t stop developing just because
              she isn&apos;t here to speak for herself.
            </p>
          </div>

          <div className="mt-12 flex flex-wrap gap-4">
            <Link
              href="/meet"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] text-[var(--paper)] px-6 py-3 text-sm hover:bg-black/80 transition-colors"
            >
              Meet Your Mom
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-6 py-3 text-sm text-[var(--ink)] hover:border-black/20 hover:bg-white transition-colors"
            >
              Why this site exists
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
