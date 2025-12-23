import Navigation from '@/components/Navigation';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]" style={{
      backgroundImage: `
        radial-gradient(1200px 520px at 10% -10%, rgba(200, 154, 106, 0.25), transparent 60%),
        radial-gradient(900px 600px at 90% 0%, rgba(217, 179, 161, 0.22), transparent 55%),
        linear-gradient(180deg, rgba(247, 241, 232, 0.9), rgba(239, 226, 212, 0.9))
      `,
      backgroundAttachment: 'fixed'
    }}>
      <Navigation />
      {children}
    </div>
  );
}
