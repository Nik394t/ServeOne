'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

import { AppRole, getMobileNavigationForRole } from '@/lib/navigation';

export function MobileNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const items = getMobileNavigationForRole(role);

  if (!items.length) {
    return null;
  }

  return (
    <nav className="fixed inset-x-2 bottom-2 z-40 rounded-[22px] border border-white/75 bg-white/88 p-1.5 shadow-shell backdrop-blur sm:inset-x-3 sm:bottom-3 sm:rounded-[26px] sm:p-2 lg:hidden">
      <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'min-w-[82px] rounded-[18px] border px-2.5 py-2.5 text-center text-[10px] font-semibold leading-tight transition sm:min-w-[94px] sm:rounded-[20px] sm:px-3 sm:py-3 sm:text-[11px]',
                active
                  ? 'border-brand/20 bg-[linear-gradient(180deg,_#285ea8,_#1d4c8d)] text-white shadow-panel'
                  : 'border-line/70 bg-white/70 text-muted hover:bg-brandSoft hover:text-ink'
              )}
            >
              {item.shortLabel}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
