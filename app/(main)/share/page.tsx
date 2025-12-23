import MemoryForm from "@/components/MemoryForm";

const quickPrompts = [
  "Val would want you to know...",
  "A piece of advice Val gave me...",
  "Something Val would say to you...",
  "Your mom would be proud because...",
  "When times get hard, remember...",
  "One word that describes Val is...",
];

const guidelines = [
  "Be specific: a moment, a place, a sound, a phrase she used.",
  "Name your relationship so her kids know who to ask for more.",
  "If the memory is sensitive, note it so Derek can place it well.",
];

export default function SharePage() {
  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-20 top-6 h-60 w-60 rounded-full bg-[color:var(--clay)]/20 blur-3xl" />
        <div className="pointer-events-none absolute right-[-120px] top-[-80px] h-64 w-64 rounded-full bg-[color:var(--sage)]/20 blur-3xl" />
        <div className="max-w-6xl mx-auto px-6 pt-14 pb-10 relative">
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--ink-soft)]">
            Contributor portal
          </p>
          <h1 className="text-4xl sm:text-5xl font-serif text-[var(--ink)] mt-4">
            Help Them Know Her
          </h1>
          <p className="text-lg text-[var(--ink-soft)] leading-relaxed mt-3 max-w-3xl">
            Val&apos;s children were young when Huntington&apos;s took hold. Her youngest
            has no memories of their mother healthy. Her oldest was 10. What you
            share here is how they will know her.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid gap-8 lg:grid-cols-[0.9fr,1.1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm">
              <h2 className="text-2xl font-serif text-[var(--ink)] mb-3">
                Take your time
              </h2>
              <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
                Be specific. Help them see her, hear her, and feel what it was like
                to be around her. Even a short memory can become a lifelong anchor.
              </p>
            </div>

            <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm">
              <h3 className="text-xl font-serif text-[var(--ink)] mb-3">
                Quick message starters
              </h3>
              <p className="text-sm text-[var(--ink-soft)] mb-4">
                Use any of these as a first line in the form. Short messages are welcome.
              </p>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <span
                    key={prompt}
                    className="rounded-full border border-black/10 bg-[color:var(--paper-deep)]/70 px-3 py-1 text-xs text-[var(--ink-soft)]"
                  >
                    {prompt}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm">
              <h3 className="text-xl font-serif text-[var(--ink)] mb-3">
                What makes a memory meaningful
              </h3>
              <ul className="space-y-3 text-sm text-[var(--ink-soft)]">
                {guidelines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <MemoryForm />
          </div>
        </div>
      </section>
    </div>
  );
}
