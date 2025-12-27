import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const admin = createAdminClient();

      // Check if profile exists
      const { data: profile } = await (admin.from('profiles') as ReturnType<typeof admin.from>)
        .select('id')
        .eq('id', data.user.id)
        .single() as { data: { id: string } | null };

      if (!profile) {
        // Profile doesn't exist - create it using user metadata
        const name = data.user.user_metadata?.name || '';
        const relation = data.user.user_metadata?.relation || '';
        const email = data.user.email || '';

        if (name && relation) {
          // We have the info from signup, create profile and link contributor
          let contributorId: string | null = null;

          // Try to find existing contributor by email
          if (email) {
            const { data: existingContributor } = await (admin.from('contributors') as ReturnType<typeof admin.from>)
              .select('id')
              .ilike('email', email)
              .single() as { data: { id: string } | null };

            if (existingContributor) {
              contributorId = existingContributor.id;
            }
          }

          // If no existing contributor, create one
          if (!contributorId) {
            const { data: newContributor } = await (admin.from('contributors') as ReturnType<typeof admin.from>)
              .insert({
                name,
                relation,
                email,
              })
              .select('id')
              .single() as { data: { id: string } | null };

            contributorId = newContributor?.id || null;
          }

          // Create profile
          await (admin.from('profiles') as ReturnType<typeof admin.from>).insert({
            id: data.user.id,
            name,
            relation,
            email,
            contributor_id: contributorId,
          });

          return NextResponse.redirect(`${origin}${next}`);
        } else {
          // No metadata - redirect to complete profile
          return NextResponse.redirect(`${origin}/auth/complete-profile`);
        }
      }

      // Profile exists, redirect to destination
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth code error or no code
  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`);
}
