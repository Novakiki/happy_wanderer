export default function PhotosPage() {
  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-20 top-6 h-60 w-60 rounded-full bg-[color:var(--clay)]/20 blur-3xl" />
        <div className="pointer-events-none absolute right-[-120px] top-[-80px] h-64 w-64 rounded-full bg-[color:var(--sage)]/20 blur-3xl" />
        <div className="max-w-4xl mx-auto px-6 pt-14 pb-10 relative text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--ink-soft)]">
            Kids portal
          </p>
          <h1 className="text-4xl sm:text-5xl font-serif text-[var(--ink)] mt-4">
            Photos Through the Years
          </h1>
          <p className="text-base text-[var(--ink-soft)] mt-3">
            A gallery organized by era, from childhood to young mom.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm text-center">
          <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
            The photo gallery is on the way. Derek will upload and caption photos,
            and each image will be placed in the right privacy circle.
          </p>
        </div>
      </section>
    </div>
  );
}
