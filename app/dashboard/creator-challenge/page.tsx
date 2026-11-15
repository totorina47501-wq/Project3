import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { CreatorChallenge } from '@/components/CreatorChallenge';

export const dynamic = 'force-dynamic';

export default async function CreatorChallengePage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect('/login');

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data.user.id));
  const accountHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');

  return <CreatorChallenge accountHash={accountHash} />;
}
