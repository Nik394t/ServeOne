'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';

import { apiFetch } from '@/lib/api';
import { AppRole, getNavigationForRole } from '@/lib/navigation';

export function SidebarNav({ role, fullName }: { role: AppRole; fullName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = getNavigationForRole(role);

  async function handleLogout() {
    await apiFetch('/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <aside className="surface-card-dark flex h-full flex-col rounded-[30px] px-5 py-6 text-white">
      <div className="mb-8 space-y-2">
        <p className="text-xs uppercase tracking-[0.26em] text-white/50">ServeOne</p>
        <h2 className="text-xl font-semibold">Рабочая панель</h2>
        <p className="text-sm text-white/65">{fullName}</p>
        <p className="inline-flex w-fit rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/80">
          {role}
        </p>
      </div>

      <div className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/38">Навигация</div>

      <nav className="hide-scrollbar flex-1 space-y-2 overflow-y-auto">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'relative block rounded-2xl px-4 py-3 text-sm transition',
                active ? 'bg-white text-[#18304f] shadow-panel' : 'text-white/72 hover:bg-white/10 hover:text-white'
              )}
            >
              <span
                className={clsx(
                  'absolute left-2 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full transition',
                  active ? 'bg-[#285ea8]' : 'bg-transparent'
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-6 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/16"
      >
        Выйти
      </button>
    </aside>
  );
}
