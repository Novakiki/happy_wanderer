import Link from "next/link";
import Chat from "@/components/Chat";

const sections = [
  {
    title: "Chapters",
    description: "Read her life in chapters: childhood, ambition, love, joy, faith.",
    href: "/chapters",
  },
  {
    title: "Photos",
    description: "A gallery of Val through the years, organized by era.",
    href: "/photos",
  },
  {
    title: "Messages",
    description: "Letters and quick notes directly written to the kids.",
    href: "/letters",
  },
  {
    title: "Voices",
    description: "Audio, video, and favorite quotes when available.",
    href: "/voices",
  },
];

export default function MeetPage() {
  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-[color:var(--sage)]/25 blur-3xl" />
        <div className="pointer-events-none absolute right-[-120px] top-[-60px] h-64 w-64 rounded-full bg-[color:var(--blush)]/25 blur-3xl" />
        <div className="max-w-5xl mx-auto px-6 pt-14 pb-10 relative">
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--ink-soft)]">
            Kids portal
          </p>
          <h1 className="text-4xl sm:text-5xl font-serif text-[var(--ink)] mt-4">
            Meet Your Mom
          </h1>
          <p className="text-lg text-[var(--ink-soft)] leading-relaxed mt-3 max-w-2xl">
            This space is for Val&apos;s children to ask anything, read her story,
            and feel her presence through real memories.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.title}
              href={section.href}
              className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm hover:shadow-md transition-all"
            >
              <h2 className="text-2xl font-serif text-[var(--ink)]">
                {section.title}
              </h2>
              <p className="text-sm text-[var(--ink-soft)] leading-relaxed mt-2">
                {section.description}
              </p>
              <span className="inline-block mt-4 text-xs uppercase tracking-[0.3em] text-[var(--clay)]">
                Explore
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="flex flex-col gap-2 mb-6">
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--ink-soft)]">
            Ask anything about Mom
          </p>
          <h2 className="text-3xl font-serif text-[var(--ink)]">
            A careful, honest chat
          </h2>
          <p className="text-sm text-[var(--ink-soft)] max-w-2xl">
            Every response comes directly from memories shared by family and friends,
            plus verified facts from her obituary. If no one has shared a memory yet,
            the chat will tell you.
          </p>
        </div>
        <Chat />
      </section>
    </div>
  );
}
