'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ScanLine, MessageCircle, Images, Archive } from 'lucide-react';

const links = [
  { href: '/dashboard', title: 'Cockpit', Icon: LayoutDashboard },
  { href: '/dashboard/check', title: 'Check', Icon: ScanLine },
  { href: '/dashboard/mia', title: 'Mia', Icon: MessageCircle },
  { href: '/dashboard/media', title: 'Médias', Icon: Images },
  { href: '/dashboard/archive', title: 'Archives', Icon: Archive },
];

export function DashboardMobileNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {links.map(({ href, title, Icon }) => {
          const current = pathname === href || (href !== '/dashboard' && pathname?.startsWith(`${href}/`));
          return (
            <Link key={href} href={href} aria-current={current ? 'page' : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${current ? 'bg-indigo-50 text-indigo-800' : 'text-slate-700 hover:bg-indigo-50'}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
              {title}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
