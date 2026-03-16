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
    <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[26px] border border-white/75 bg-white/88 p-2 shadow-shell backdrop-blur lg:hidden">
      <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'min-w-[108px] rounded-[20px] border px-3 py-3 text-center text-[11px] font-semibold leading-tight transition',
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
