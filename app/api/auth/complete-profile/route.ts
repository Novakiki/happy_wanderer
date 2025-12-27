import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { name, relation, email } = await request.json();

    if (!name || !relation) {
      return NextResponse.json({ error: 'Name and relationship are required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check if profile already exists
    const { data: existingProfile } = await (admin.from('profiles') as ReturnType<typeof admin.from>)
      .select('id')
      .eq('id', user.id)
      .single() as { data: { id: string } | null };

    if (existingProfile) {
      return NextResponse.json({ error: 'Profile already exists' }, { status: 400 });
    }

    // Try to find existing contributor by email
    let contributorId: string | null = null;
    const userEmail = email || user.email || '';

    if (userEmail) {
      const { data: existingContributor } = await (admin.from('contributors') as ReturnType<typeof admin.from>)
        .select('id')
        .ilike('email', userEmail)
        .single() as { data: { id: string } | null };

      if (existingContributor) {
        contributorId = existingContributor.id;
      }
    }

    // If no existing contributor, create one
    if (!contributorId) {
      const { data: newContributor, error: contribError } = await (admin.from('contributors') as ReturnType<typeof admin.from>)
        .insert({
          name: name.trim(),
          relation: relation.trim(),
          email: userEmail || null,
        })
        .select('id')
        .single() as { data: { id: string } | null; error: unknown };

      if (contribError) {
        console.error('Error creating contributor:', contribError);
        return NextResponse.json({ error: 'Failed to create contributor' }, { status: 500 });
      }

      contributorId = newContributor?.id || null;
    }

    // Create profile
    const { error: profileError } = await (admin.from('profiles') as ReturnType<typeof admin.from>).insert({
      id: user.id,
      name: name.trim(),
      relation: relation.trim(),
      email: userEmail,
      contributor_id: contributorId,
    });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Complete profile error:', error);
    return NextResponse.json({ error: 'Failed to complete profile' }, { status: 500 });
  }
}
