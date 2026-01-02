import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { subtleBackground } from "@/lib/styles";
import { redirect } from "next/navigation";

export default async function ContributePage() {
  // Get authenticated user and profile
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch user profile
  const { data: profile } = (await supabase
    .from("profiles")
    .select("name, relation, email, contributor_id")
    .eq("id", user.id)
    .single()) as {
    data:
      | { name: string; relation: string; email: string; contributor_id: string | null }
      | null;
  };

  if (!profile) {
    redirect("/auth/complete-profile");
  }

  const userProfile = {
    name: profile.name,
    relation: profile.relation,
    email: profile.email,
    contributorId: profile.contributor_id || "",
  };

  return (
    <div className="min-h-screen text-white bg-[#0b0b0b]" style={subtleBackground}>
      <Nav userProfile={userProfile} />
      <section className="max-w-2xl mx-auto px-6 pt-24 pb-16">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Contributors</p>
        <h1 className="text-3xl sm:text-4xl font-serif text-white mt-4">
          Contribute to Valerie&apos;s score
        </h1>
        <p className="text-lg text-white/60 leading-relaxed mt-3">Two ways to begin.</p>

        <div className="mt-10 grid gap-4 md:grid-cols-2 md:gap-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-6">
            <h2 className="text-xl font-serif text-white">Write a note</h2>
            <p className="text-sm text-white/60 mt-2">Capture what happened.</p>
            <div className="mt-5">
              <Link
                href="/share"
                className="inline-flex items-center justify-center rounded-full bg-[#e07a5f] text-white px-5 py-2.5 text-xs uppercase tracking-[0.15em] font-medium hover:bg-[#d06a4f] transition-colors"
              >
                Write a note
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-6">
            <h2 className="text-xl font-serif text-white">Share a fragment</h2>
            <p className="text-sm text-white/60 mt-2">Capture what stood out.</p>
            <div className="mt-5">
              <Link
                href="/fragment"
                className="inline-flex items-center justify-center rounded-full border-2 border-dashed border-[#e07a5f]/55 text-white/85 px-5 py-2.5 text-xs uppercase tracking-[0.15em] font-medium hover:border-[#e07a5f]/85 hover:bg-[#e07a5f]/10 hover:text-white transition-colors"
              >
                Share a fragment
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

