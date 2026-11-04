// Chemin : app/dashboard/layout.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';
import type { Metadata } from 'next';
import { LayoutDashboard, ScanLine, MessageCircle, Images, Archive } from 'lucide-react';

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
          <Link href="/" className="font-heading text-xl font-bold text-primary">
            <span className="text-accent">✓</span> MentionCheck
          </Link>
          <div className="hidden flex-wrap items-center gap-2 md:flex md:gap-5">
            <Link href="/dashboard" className="text-sm font-semibold hover:text-accent">Tableau de bord</Link>
            <Link href="/dashboard/check" className="text-sm font-semibold hover:text-accent">Check ma publication</Link>
            <Link href="/dashboard/media" className="text-sm font-semibold hover:text-accent">Médias</Link>
            <Link href="/dashboard/mia" className="text-sm font-semibold hover:text-accent">Parler à Mia</Link>
            <Link href="/dashboard/archive" className="text-sm font-semibold hover:text-accent">Archives</Link>
            <Link href="/dashboard/settings" className="text-sm font-semibold hover:text-accent">Paramètres</Link>
            <LogoutButton />
          </div>
          <div className="flex items-center gap-3 md:hidden">
            <Link href="/dashboard/settings" className="text-sm font-semibold text-slate-700">Paramètres</Link>
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-28 pt-9 md:pb-9">{children}</main>
      <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {[
            {href:'/dashboard',title:'Cockpit',Icon:LayoutDashboard},
            {href:'/dashboard/check',title:'Check',Icon:ScanLine},
            {href:'/dashboard/mia',title:'Mia',Icon:MessageCircle},
            {href:'/dashboard/media',title:'Médias',Icon:Images},
            {href:'/dashboard/archive',title:'Archives',Icon:Archive},
          ].map(({href,title,Icon}) => <Link key={href} href={href}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold text-slate-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-500">
            <Icon className="h-5 w-5" aria-hidden="true" />
            {title}
          </Link>)}
        </div>
      </nav>
    </div>
  );
}
