import { adminClient } from './env';

type AdminUser = { id: string; email?: string | null };

async function findUserByEmail(email: string) {
  if (!adminClient) return null;
  const { data, error } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error || !data?.users) return null;
  return (data.users as AdminUser[]).find((user) => user.email?.toLowerCase() === email) ?? null;
}

export async function ensureAdminProfile(email: string) {
  if (!adminClient) return;

  const normalizedEmail = email.trim().toLowerCase();
  let userId = (await findUserByEmail(normalizedEmail))?.id ?? null;

  if (!userId) {
    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
    });
    if (createError || !createData?.user?.id) return;
    userId = createData.user.id;
  }

  const { data: profileRows } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId);

  if (profileRows && profileRows.length > 0) return;

  let contributorId: string | null = null;
  const { data: contributors } = await adminClient
    .from('contributors')
    .select('id')
    .ilike('email', normalizedEmail);

  if (contributors && contributors.length > 0) {
    contributorId = (contributors[0] as { id: string }).id;
  }

  if (!contributorId) {
    const { data: newContributor } = await adminClient
      .from('contributors')
      .insert({
        name: 'E2E Admin',
        relation: 'admin',
        email: normalizedEmail,
      })
      .select('id')
      .single();
    contributorId = (newContributor as { id?: string } | null)?.id ?? null;
  }

  await adminClient.from('profiles').insert({
    id: userId,
    name: 'E2E Admin',
    relation: 'admin',
    email: normalizedEmail,
    contributor_id: contributorId,
  });
}
