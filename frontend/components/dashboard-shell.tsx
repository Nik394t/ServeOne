'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { apiFetch, AuthResponse } from '@/lib/api';
import { MobileNav } from '@/components/mobile-nav';
import { SidebarNav } from '@/components/sidebar-nav';
import { canAccessPath, getDefaultDashboardPath, getTitleForPath } from '@/lib/navigation';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthResponse['user'] | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    apiFetch<AuthResponse>('/auth/me')
      .then((payload) => {
        setUser(payload.user);
        setResolved(true);
      })
      .catch(() => {
        setUser(null);
        setResolved(true);
        router.replace('/login');
      });
  }, [router]);

  useEffect(() => {
    if (!user) {
      return;
    }
    if (!canAccessPath(pathname, user.role)) {
      router.replace(getDefaultDashboardPath(user.role));
    }
  }, [pathname, router, user]);

  if (!resolved || !user) {
    return (
      <div className="min-h-screen p-3 text-ink sm:p-4 lg:p-5">
        <div className="mx-auto max-w-[1600px] rounded-[32px] border border-white/70 bg-white/60 p-6 shadow-shell backdrop-blur">
          <p className="text-sm text-muted">Проверка доступа...</p>
        </div>
      </div>
    );
  }

  if (!canAccessPath(pathname, user.role)) {
    return (
      <div className="min-h-screen p-3 text-ink sm:p-4 lg:p-5">
        <div className="mx-auto max-w-[1600px] rounded-[32px] border border-white/70 bg-white/60 p-6 shadow-shell backdrop-blur">
          <p className="text-sm text-muted">Перенаправление...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden p-3 text-ink sm:p-4 lg:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(circle_at_top_left,_rgba(40,94,168,0.14),_transparent_44%),radial-gradient(circle_at_top_right,_rgba(197,77,83,0.12),_transparent_28%)]" />
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1600px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <SidebarNav role={user.role} fullName={user.full_name || user.login} />
        </div>

        <main className="surface-card relative flex min-h-full flex-col gap-4 rounded-[32px] p-4 pb-24 lg:p-5 lg:pb-5">
          <header className="surface-card-strong flex flex-col gap-4 rounded-[28px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">ServeOne Workspace</p>
              <h1 className="mt-2 text-[1.7rem] font-semibold tracking-[-0.03em] text-ink sm:text-[1.95rem]">
                {getTitleForPath(pathname)}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line/70 bg-white/90 px-3 py-3 text-sm text-muted">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
              <span className="font-medium text-ink">{user.full_name || user.login}</span>
              <span className="dashboard-chip">{user.role}</span>
            </div>
          </header>
          <div className="flex-1">{children}</div>
        </main>
      </div>
      <MobileNav role={user.role} />
    </div>
  );
}
