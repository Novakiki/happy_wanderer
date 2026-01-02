import FragmentCaptureForm from "@/components/FragmentCaptureForm";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { subtleBackground } from "@/lib/styles";
import { redirect } from "next/navigation";

export default async function FragmentPage() {
  // Get authenticated user and profile
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, relation, email, contributor_id")
    .eq("id", user.id)
    .single() as { data: { name: string; relation: string; email: string; contributor_id: string | null } | null };

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
    <div
      className="min-h-screen text-white bg-[#0b0b0b]"
      style={subtleBackground}
    >
      <Nav userProfile={userProfile} />
      <section className="max-w-2xl mx-auto px-6 pt-24 pb-16">
        <FragmentCaptureForm contributorId={userProfile.contributorId} />
      </section>
    </div>
  );
}
