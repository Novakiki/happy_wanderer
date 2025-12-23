const stats = [
  { label: "Pending review", value: "3 memories, 1 photo" },
  { label: "Total memories", value: "47" },
  { label: "Photos", value: "23" },
  { label: "Messages", value: "12" },
];

const actions = [
  "Review new submissions",
  "Upload photos",
  "Manage memories",
  "Edit site content",
];

export default function AdminPage() {
  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-20 top-10 h-60 w-60 rounded-full bg-[color:var(--blush)]/25 blur-3xl" />
        <div className="pointer-events-none absolute right-[-120px] top-[-80px] h-64 w-64 rounded-full bg-[color:var(--clay)]/25 blur-3xl" />
        <div className="max-w-5xl mx-auto px-6 pt-14 pb-10 relative">
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--ink-soft)]">
            Admin
          </p>
          <h1 className="text-4xl sm:text-5xl font-serif text-[var(--ink)] mt-4">
            Derek&apos;s Dashboard
          </h1>
          <p className="text-lg text-[var(--ink-soft)] leading-relaxed mt-3 max-w-2xl">
            Review what comes in, set privacy levels, and shape the story with care.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-16 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl border border-black/10 bg-white/70 p-5 shadow-sm"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">
                {stat.label}
              </p>
              <p className="text-2xl font-serif text-[var(--ink)] mt-3">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.6fr,1fr]">
          <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm">
            <h2 className="text-2xl font-serif text-[var(--ink)] mb-4">
              Quick actions
            </h2>
            <div className="space-y-3">
              {actions.map((action) => (
                <div
                  key={action}
                  className="rounded-2xl border border-black/10 bg-[color:var(--paper-deep)]/70 px-4 py-3 text-sm text-[var(--ink-soft)]"
                >
                  {action}
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--ink-soft)] mt-4">
              Admin tools are under construction. For now, this is a visual guide.
            </p>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm">
            <h2 className="text-2xl font-serif text-[var(--ink)] mb-4">
              Review queue
            </h2>
            <div className="rounded-2xl border border-black/10 bg-white/80 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">
                New submission
              </p>
              <p className="text-sm text-[var(--ink)] mt-3">
                From: Amy Grant (cousin)
              </p>
              <p className="text-sm text-[var(--ink-soft)] mt-2 leading-relaxed">
                &quot;Val&apos;s laugh was this high-pitched giggle that would take over
                her whole body. Once at Thanksgiving she laughed so hard at dad&apos;s
                joke that Pepsi came out...&quot;
              </p>
              <div className="flex flex-wrap gap-2 mt-4 text-xs text-[var(--ink-soft)]">
                <span className="rounded-full border border-black/10 px-3 py-1">
                  #funny
                </span>
                <span className="rounded-full border border-black/10 px-3 py-1">
                  #childhood
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 mt-5 text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">
                <div className="rounded-full border border-black/10 px-3 py-2 text-center">
                  Approve
                </div>
                <div className="rounded-full border border-black/10 px-3 py-2 text-center">
                  Edit
                </div>
                <div className="rounded-full border border-black/10 px-3 py-2 text-center">
                  Reject
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
