import MemoryForm from "@/components/MemoryForm";
import Nav from "@/components/Nav";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { subtleBackground } from "@/lib/styles";
import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ responding_to?: string; storyteller?: string }>;
};

type RespondingToEvent = {
  id: string;
  title: string;
  preview: string | null;
  contributorName: string | null;
};

export default async function SharePage({ searchParams }: Props) {
  const params = await searchParams;
  const respondingTo = params.responding_to;
  const storytellerName = params.storyteller;

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
    trusted: false,
  };

  let trustRequestStatus: 'pending' | 'approved' | 'declined' | null = null;

  if (profile.contributor_id) {
    const admin = createAdminClient();

    const { data: contributor } = await admin
      .from("contributors")
      .select("trusted")
      .eq("id", profile.contributor_id)
      .single();

    userProfile.trusted = contributor?.trusted === true;

    const { data: requestRows } = await admin
      .from("trust_requests")
      .select("status")
      .eq("contributor_id", profile.contributor_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const rawStatus = requestRows?.[0]?.status ?? null;
    if (rawStatus === 'pending' || rawStatus === 'approved' || rawStatus === 'declined') {
      trustRequestStatus = rawStatus;
    }
  }

  // Fetch the event being responded to (if any)
  let respondingToEvent: RespondingToEvent | null = null;
  if (respondingTo) {
    const admin = createAdminClient();
    const { data: eventData } = await admin
      .from("current_notes")
      .select("id, title, preview, contributor_id")
      .eq("id", respondingTo)
      .single();

    if (eventData && eventData.id && eventData.title) {
      let contributorName: string | null = null;
      if (eventData.contributor_id) {
        const { data: contributor } = await admin
          .from("contributors")
          .select("name")
          .eq("id", eventData.contributor_id)
          .single();
        contributorName = contributor?.name ?? null;
      }

      respondingToEvent = {
        id: eventData.id,
        title: eventData.title,
        preview: eventData.preview,
        contributorName,
      };
    }
  }

  return (
    <div
      className="min-h-screen text-white bg-[#0b0b0b]"
      style={subtleBackground}
    >
      <Nav userProfile={userProfile} />
      <section className="max-w-2xl mx-auto px-6 pt-24 pb-16">
        <MemoryForm
          respondingToEventId={respondingTo}
          respondingToEvent={respondingToEvent}
          storytellerName={storytellerName}
          userProfile={userProfile}
          trustRequestStatus={trustRequestStatus}
        />
      </section>
    </div>
  );
}
