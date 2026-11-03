// Chemin : app/dashboard/layout.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect('/login');
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect('/login');
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <nav aria-label="Navigation principale" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href="/" className="font-heading text-xl font-bold text-primary">
            <span className="text-accent">✓</span> MentionCheck
          </Link>
          <div className="flex flex-wrap items-center gap-2 sm:gap-5">
            <Link href="/dashboard" className="text-sm font-semibold hover:text-accent">Tableau de bord</Link>
            <Link href="/dashboard/check" className="text-sm font-semibold hover:text-accent">Check ma publication</Link>
            <Link href="/dashboard/mia" className="text-sm font-semibold hover:text-accent">Parler à Mia</Link>
            <Link href="/dashboard/archive" className="text-sm font-semibold hover:text-accent">Archives</Link>
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-9">{children}</main>
    </div>
  );
}
