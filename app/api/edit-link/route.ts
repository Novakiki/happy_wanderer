import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export async function POST(request: NextRequest) {
  // Require Supabase auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  try {
    const body = await request.json();
    const {
      contributor_id,
      contributor_email,
      contributor_name,
      hours_valid = 48,
    } = body || {};

    if (!contributor_id && !contributor_email && !contributor_name) {
      return NextResponse.json(
        { error: "Provide contributor_id or contributor_email or contributor_name" },
        { status: 400 }
      );
    }

    let resolvedContributorId: string | null = contributor_id || null;

    // Try to resolve by email
    if (!resolvedContributorId && contributor_email) {
      const { data: contributorByEmail }: { data: { id: string } | null } = await admin
        .from("contributors")
        .select("id")
        .ilike("email", contributor_email.trim())
        .single();

      if (contributorByEmail?.id) {
        resolvedContributorId = contributorByEmail.id;
      }
    }

    // Try to resolve by name
    if (!resolvedContributorId && contributor_name) {
      const { data: contributorByName }: { data: { id: string } | null } = await admin
        .from("contributors")
        .select("id")
        .ilike("name", contributor_name.trim())
        .single();

      if (contributorByName?.id) {
        resolvedContributorId = contributorByName.id;
      }
    }

    // Create a new contributor if we still don't have one but have a name
    if (!resolvedContributorId && contributor_name) {
      const newContributor: Database["public"]["Tables"]["contributors"]["Insert"] = {
        name: contributor_name.trim(),
        relation: "family/friend",
        email: contributor_email?.trim() || null,
      };

      const { data, error } = await (admin
        .from("contributors") as unknown as ReturnType<typeof admin.from>)
        .insert(newContributor as any)
        .select("id")
        .single();

      if (error) {
        console.error("Failed to create contributor for edit token:", error);
        return NextResponse.json({ error: "Failed to create contributor" }, { status: 500 });
      }

      resolvedContributorId = data?.id ?? null;
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + Number(hours_valid) * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await (admin
      .from("edit_tokens") as unknown as ReturnType<typeof admin.from>)
      .insert({
        token,
        contributor_id: resolvedContributorId,
        expires_at: expiresAt,
      } as any);

    if (insertError) {
      console.error("Failed to create edit token:", insertError);
      return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
    }

    const origin = new URL(request.url).origin;
    const link = `${origin}/edit?token=${token}`;

    return NextResponse.json({ link, token, expires_at: expiresAt });
  } catch (error) {
    console.error("Edit link error:", error);
    return NextResponse.json({ error: "Failed to create edit link" }, { status: 500 });
  }
}
