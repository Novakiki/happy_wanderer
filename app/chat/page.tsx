import Chat from '@/components/Chat';
import Nav from '@/components/Nav';
import { subtleBackground, formStyles } from '@/lib/styles';
import { SITE_TITLE } from '@/lib/terminology';

export default function ChatPage() {
  return (
    <div
      className={formStyles.pageContainer}
      style={subtleBackground}
    >
      <Nav />
      <section className={formStyles.contentWrapper}>
        <p className={formStyles.subLabel}>
          {SITE_TITLE}
        </p>
        <h1 className={formStyles.pageTitle}>
          Chat with her patterns
        </h1>
        <p className={formStyles.pageDescription}>
          Ask questions about Val. Everything comes from notes shared by family and friends.
        </p>

        <div className="mt-8">
          <Chat />
        </div>
      </section>
    </div>
  );
}
