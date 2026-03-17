'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import {
  apiFetch,
  AuthResponse,
  clearRuntimeApiBase,
  getExplicitApiBase,
  getRuntimeApiBase,
  saveRuntimeApiBase
} from '@/lib/api';

const REMEMBERED_LOGIN_KEY = 'serveone-remembered-login';

function readRememberedLogin(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(REMEMBERED_LOGIN_KEY)?.trim() || '';
}

function persistRememberedLogin(login: string, rememberMe: boolean) {
  if (typeof window === 'undefined') return;
  if (rememberMe && login.trim()) {
    window.localStorage.setItem(REMEMBERED_LOGIN_KEY, login.trim());
    return;
  }
  window.localStorage.removeItem(REMEMBERED_LOGIN_KEY);
}

export function LoginForm({ nextPath = '/dashboard' }: { nextPath?: string }) {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiBaseInput, setApiBaseInput] = useState('');
  const [apiHint, setApiHint] = useState<string | null>(null);
  const [resolvedApiBase, setResolvedApiBase] = useState<string>(getRuntimeApiBase());

  useEffect(() => {
    const explicitApiBase = getExplicitApiBase();
    setApiBaseInput(explicitApiBase || '');
    setResolvedApiBase(getRuntimeApiBase());
    const rememberedLogin = readRememberedLogin();
    if (rememberedLogin) {
      setLogin(rememberedLogin);
      setRememberMe(true);
    }
    let isMounted = true;
    void apiFetch<AuthResponse>('/auth/me')
      .then(() => {
        if (!isMounted) return;
        router.replace(nextPath);
        router.refresh();
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, [nextPath, router]);

  function syncApiState(message?: string) {
    setApiBaseInput(getExplicitApiBase() || '');
    setResolvedApiBase(getRuntimeApiBase());
    setApiHint(message || null);
  }

  function handleSaveApiBase() {
    try {
      const saved = saveRuntimeApiBase(apiBaseInput);
      syncApiState(`Cloud API URL сохранён: ${saved}`);
    } catch (err) {
      setApiHint(err instanceof Error ? err.message : 'Не удалось сохранить Cloud API URL');
    }
  }

  function handleClearApiBase() {
    clearRuntimeApiBase();
    syncApiState('Runtime API URL очищен. Приложение вернулось к локальному прокси `/api/backend`.');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextLogin = login.trim();
    if (!nextLogin || !password.trim()) {
      setError('Введи логин и пароль');
      return;
    }
    setLoading(true);
    setError(null);
    const resolvedNextPath =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') || nextPath : nextPath;
    try {
      await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: nextLogin, password, remember_me: rememberMe })
      });
      persistRememberedLogin(nextLogin, rememberMe);
      router.replace(resolvedNextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[24px] border border-line/70 bg-panel/90 p-4 shadow-shell backdrop-blur sm:space-y-5 sm:p-6 xl:p-8">
      <div className="space-y-2">
        <div className="inline-flex rounded-[22px] border border-white/80 bg-white/88 p-2 shadow-panel sm:rounded-[26px]">
          <Image
            src="/icons/icon-192.png"
            alt="ServeOne"
            width={64}
            height={64}
            className="rounded-[16px] sm:h-[74px] sm:w-[74px] sm:rounded-[18px]"
            priority
          />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">ServeOne</p>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Вход в систему</h1>
        <p className="max-w-sm text-sm leading-6 text-muted">
          Рабочее пространство команды. Вход по логину и паролю, выданным создателем или администратором.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Логин</span>
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand"
            placeholder="Введите логин"
            autoComplete="username"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Пароль</span>
          <div className="flex items-center rounded-2xl border border-line bg-white pr-3 focus-within:border-brand">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              className="w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-ink outline-none"
              placeholder="Введите пароль"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="text-xs font-semibold uppercase tracking-[0.18em] text-muted"
            >
              {showPassword ? 'Скрыть' : 'Показать'}
            </button>
          </div>
        </label>
      </div>

      <details className="rounded-[22px] border border-line/70 bg-white/72 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink">
          <span>Cloud API URL</span>
          <span className="dashboard-chip max-w-[180px] truncate sm:max-w-[260px]">{resolvedApiBase}</span>
        </summary>
        <p className="mt-3 text-xs leading-6 text-muted">
          Для GitHub Pages укажи адрес backend вручную. Можно использовать query-параметр `?api=https://...`.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            value={apiBaseInput}
            onChange={(e) => setApiBaseInput(e.target.value)}
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand"
            placeholder="https://your-backend.example.com/api/v1"
          />
          <button
            type="button"
            onClick={handleSaveApiBase}
            className="rounded-2xl border border-line/70 bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
          >
            Сохранить API
          </button>
          <button
            type="button"
            onClick={handleClearApiBase}
            className="rounded-2xl border border-line/70 bg-white px-4 py-3 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
          >
            Сбросить
          </button>
        </div>
        {apiHint ? <p className="mt-3 text-xs leading-6 text-muted">{apiHint}</p> : null}
      </details>

      <label className="flex items-center gap-3 text-sm text-muted">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
        />
        Запомнить меня
      </label>

      {error ? (
        <div className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{error}</div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1f4f92] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? 'Вход...' : 'Войти'}
      </button>
    </form>
  );
}
