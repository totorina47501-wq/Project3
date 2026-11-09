// Chemin : app/dashboard/layout.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';
import { DashboardMobileNavigation, DashboardSecondaryNavigation } from '@/components/DashboardMobileNavigation';
import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false } };

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
          <Link href="/" className="whitespace-nowrap font-heading text-xl font-bold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
            <span className="text-accent">✓</span> MentionCheck
          </Link>
          <div className="hidden flex-wrap items-center gap-2 md:flex md:gap-5">
            <Link href="/dashboard" className="text-sm font-semibold hover:text-accent">Tableau de bord</Link>
            <Link href="/dashboard/check" className="text-sm font-semibold hover:text-accent">Check ma publication</Link>
            <Link href="/dashboard/media" className="text-sm font-semibold hover:text-accent">Médias</Link>
            <Link href="/dashboard/mia" className="text-sm font-semibold hover:text-accent">Parler à Mia</Link>
            <Link href="/dashboard/archive" className="text-sm font-semibold hover:text-accent">Archives</Link>
            <Link href="/dashboard/brand-deals" className="text-sm font-semibold hover:text-accent">Collaborations</Link>
            <Link href="/dashboard/studio" className="text-sm font-semibold hover:text-accent">Studio</Link>
            <Link href="/dashboard/settings" className="text-sm font-semibold hover:text-accent">Paramètres</Link>
            <LogoutButton />
          </div>
          <DashboardSecondaryNavigation />
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-28 pt-9 md:pb-9">{children}</main>
      <DashboardMobileNavigation />
    </div>
  );
}
