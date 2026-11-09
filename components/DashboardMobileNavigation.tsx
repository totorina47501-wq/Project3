'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Archive, Images, LayoutDashboard, Menu, MessageCircle, ScanLine } from 'lucide-react';
import { LogoutButton } from '@/components/LogoutButton';

const links = [
  { href: '/dashboard', title: 'Cockpit', Icon: LayoutDashboard },
  { href: '/dashboard/check', title: 'Check', Icon: ScanLine },
  { href: '/dashboard/mia', title: 'Mia', Icon: MessageCircle },
  { href: '/dashboard/media', title: 'Médias', Icon: Images },
  { href: '/dashboard/archive', title: 'Archives', Icon: Archive },
];

const secondaryLinks = [
  { href: '/dashboard/brand-deals', title: 'Collaborations' },
  { href: '/dashboard/studio', title: 'Studio' },
  { href: '/dashboard/settings', title: 'Paramètres' },
];

export function DashboardSecondaryNavigation() {
  const pathname = usePathname();

  return <DashboardSecondaryMenu key={pathname} pathname={pathname} />;
}

function DashboardSecondaryMenu({ pathname }: { pathname: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  return (
    <div className="relative shrink-0 md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Menu"
        aria-expanded={isOpen}
        aria-controls="dashboard-secondary-navigation"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        Menu
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>
      <nav
        id="dashboard-secondary-navigation"
        aria-label="Navigation secondaire"
        hidden={!isOpen}
        className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
      >
        {secondaryLinks.map(({ href, title }) => {
          const current = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={current ? 'page' : undefined}
              onClick={() => setIsOpen(false)}
              className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${current ? 'bg-indigo-50 text-indigo-800' : 'text-slate-700 hover:bg-indigo-50'}`}
            >
              {title}
            </Link>
          );
        })}
        <div className="pt-1">
          <LogoutButton className="w-full text-left" />
        </div>
      </nav>
    </div>
  );
}

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
