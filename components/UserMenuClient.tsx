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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let isActive = true;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;

      const [{ data: fetched }, adminRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('name, relation')
          .eq('id', user.id)
          .single(),
        fetch('/api/admin/status').catch(() => null),
      ]);

      if (!isActive) return;

      if (fetched) {
        setProfile({
          name: fetched.name,
          relation: fetched.relation,
        });
      }

      if (adminRes && adminRes.ok) {
        const adminData = await adminRes.json().catch(() => ({}));
        setIsAdmin(Boolean(adminData?.is_admin));
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  if (!profile) return null;
  return (
    <UserMenu
      name={profile.name}
      relation={profile.relation}
      editToken={editToken}
      isAdmin={isAdmin}
    />
  );
}
