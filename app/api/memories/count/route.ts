import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { count, error } = await supabase
      .from('timeline_events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .in('privacy_level', ['public', 'kids-only']);

    if (error) {
      console.error('Supabase count error:', error);
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('Memory count error:', error);
    return NextResponse.json({ count: 0 });
  }
}
