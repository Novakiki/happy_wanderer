import ContinueButton from "./ContinueButton";

const backgroundStyle = {
  backgroundImage: `
    radial-gradient(900px 520px at 12% -8%, rgba(224, 122, 95, 0.12), transparent 60%),
    radial-gradient(700px 520px at 88% 6%, rgba(124, 138, 120, 0.12), transparent 55%),
    linear-gradient(180deg, rgba(11, 11, 11, 1), rgba(5, 5, 5, 1))
  `,
  backgroundAttachment: "fixed" as const,
};

export default function LetterPage() {
  return (
    <div className="min-h-screen text-white bg-[#0b0b0b]" style={backgroundStyle}>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-8">
          A letter to her children
        </p>

        <div className="space-y-6 text-white/70 leading-relaxed">
          <p className="text-white">
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

          <div className="border-l-2 border-white/10 pl-6 my-8 text-white/80">
            <p>
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

        <div className="mt-12 pt-8 border-t border-white/10 text-white/50 italic leading-relaxed">
          You can come back to this space again and again&mdash;as you grow
          older, as your life changes, as new questions appear. Your
          relationship to your mother doesn&apos;t stop developing just because
          she isn&apos;t here to speak for herself.
        </div>

        <ContinueButton />
      </div>
    </div>
  );
}
