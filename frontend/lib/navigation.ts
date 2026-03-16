export type AppRole = 'creator' | 'admin' | 'user' | 'deleted' | 'loading';

export type NavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
  roles: Array<'creator' | 'admin' | 'user'>;
  mobilePriority: number;
  title: string;
};

export const navigationItems: NavigationItem[] = [
  { href: '/dashboard', label: 'Главная', shortLabel: 'Главная', roles: ['creator', 'admin', 'user'], mobilePriority: 1, title: 'Обзор' },
  { href: '/dashboard/schedule', label: 'Служения', shortLabel: 'Служения', roles: ['creator', 'admin', 'user'], mobilePriority: 2, title: 'Служения и ротация' },
  { href: '/dashboard/duty', label: 'Дежурства', shortLabel: 'Дежурства', roles: ['creator', 'admin'], mobilePriority: 6, title: 'Дежурства' },
  { href: '/dashboard/instructions', label: 'Инструктажи', shortLabel: 'Инструктажи', roles: ['creator', 'admin', 'user'], mobilePriority: 4, title: 'Инструктажи' },
  { href: '/dashboard/users', label: 'Участники', shortLabel: 'Участники', roles: ['creator', 'admin'], mobilePriority: 8, title: 'Участники' },
  { href: '/dashboard/birthdays', label: 'Дни рождения', shortLabel: 'ДР', roles: ['creator', 'admin', 'user'], mobilePriority: 7, title: 'Дни рождения' },
  { href: '/dashboard/broadcasts', label: 'Рассылки', shortLabel: 'Рассылки', roles: ['creator', 'admin'], mobilePriority: 9, title: 'Рассылки' },
  { href: '/dashboard/messages', label: 'Сообщения', shortLabel: 'Сообщения', roles: ['creator', 'admin', 'user'], mobilePriority: 3, title: 'Сообщения' },
  { href: '/dashboard/reports', label: 'Отчёты', shortLabel: 'Отчёты', roles: ['creator', 'admin'], mobilePriority: 10, title: 'Отчёты' },
  { href: '/dashboard/settings', label: 'Настройки', shortLabel: 'Настройки', roles: ['creator', 'admin', 'user'], mobilePriority: 5, title: 'Настройки' }
];

export function getNavigationForRole(role: AppRole): NavigationItem[] {
  if (!isAppRole(role) || role === 'deleted' || role === 'loading') {
    return [];
  }
  return navigationItems.filter((item) => item.roles.includes(role));
}

export function getMobileNavigationForRole(role: AppRole): NavigationItem[] {
  return [...getNavigationForRole(role)].sort((left, right) => left.mobilePriority - right.mobilePriority);
}

export function canAccessPath(pathname: string, role: AppRole): boolean {
  if (!isAppRole(role) || role === 'deleted' || role === 'loading') {
    return false;
  }
  return navigationItems.some((item) => pathMatches(item.href, pathname) && item.roles.includes(role));
}

export function getDefaultDashboardPath(role: AppRole): string {
  const items = getMobileNavigationForRole(role);
  return items[0]?.href || '/dashboard';
}

export function getTitleForPath(pathname: string): string {
  const direct = navigationItems.find((item) => pathMatches(item.href, pathname));
  return direct?.title || 'Панель';
}

function isAppRole(role: string): role is AppRole {
  return ['creator', 'admin', 'user', 'deleted', 'loading'].includes(role);
}

function pathMatches(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
