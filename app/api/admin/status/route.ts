import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin';

export async function GET() {
  const adminUser = await getAdminUser();
  return NextResponse.json({ is_admin: Boolean(adminUser) });
}
