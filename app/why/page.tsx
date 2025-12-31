import { immersiveBackground } from "@/lib/styles";
import Link from "next/link";
import ContinueButton from "./ContinueButton";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    from?: string;
    inviteId?: string;
  }>;
};

export default async function LetterPage({ searchParams }: Props) {
  const params = await searchParams;
  const hideContinue = params?.from === "invite";
  const inviteId = params?.inviteId;
  const inviteLink = inviteId ? `/respond/${inviteId}` : null;
  return (
    <div className="min-h-screen text-white bg-[#0b0b0b]" style={immersiveBackground}>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-8">
          Valerie Park Anderson
        </p>

        <div className="space-y-6 text-white/70 leading-relaxed">
          <p className="text-white">
            Restoring Transmission
          </p>

          <p>
            At a biological level, speech depends on timing, sequencing, and
            coordinated movement. When these systems weaken, meaning does not
            disappear; the pathways that carry it lose synchronization.
            Expression becomes fragmented not because thought is gone, but
            because coordination fails.
          </p>

          <p>
            A similar dependency operates across a human life. Identity is
            carried less through explicit narration than through recurring
            patterns of action. Long before someone can explain who they are,
            they have already shown it&mdash;through choices, habits,
            relationships, and through timing itself: how they responded, what
            they noticed, what they returned to. A life is learned this way,
            through rhythm and repetition, rather than as a linear account.
          </p>

          <p>
            Huntington&apos;s disease disrupted the systems that once allowed
            Valerie&apos;s presence to be easily perceived. What it took from
            her was not meaning or intention, but the conditions that made them
            legible to others&mdash;especially to her children.
          </p>

          <p>
            What follows is a collective effort to recover legibility&mdash;first
            for her children, and through them for anyone trying to recognize
            someone who can no longer be encountered directly.
          </p>

          <p>
            Each story restores a point of contact&mdash;her humor, her judgment,
            her care; how she made decisions, what she noticed, how ordinary
            moments changed around her. Individually, these fragments are
            incomplete. Together, they allow a pattern to reappear.
          </p>

          <p>
            That pattern is not memory, but a way of being that once lived openly in her body
            and voice and later had to operate more quietly. Like notes carried
            by different instruments, these fragments preserve elements of the
            same original motion.
          </p>

          <p>
            Where speech was lost, language re-enters differently: distributed
            across people, unfolding over time, and held collectively.
          </p>

        </div>

        {hideContinue && inviteLink ? (
          <div className="mt-10">
            <Link
              href={inviteLink}
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Back to your invitation →
            </Link>
          </div>
        ) : null}

        {!hideContinue && <ContinueButton />}
      </div>
    </div>
  );
}
