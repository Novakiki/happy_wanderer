'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import UserMenu from '@/components/UserMenu';

type UserProfile = {
  name: string;
  relation: string;
};

type Props = {
  editToken?: string;
};

export default function UserMenuClient({ editToken }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      const { data: fetched } = await supabase
        .from('profiles')
        .select('name, relation')
        .eq('id', user.id)
        .single();
      if (fetched) {
        setProfile({
          name: fetched.name,
          relation: fetched.relation,
        });
      }
    });
  }, []);

  if (!profile) return null;
  return <UserMenu name={profile.name} relation={profile.relation} editToken={editToken} />;
}
