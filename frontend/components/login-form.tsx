'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import { apiFetch, AuthResponse } from '@/lib/api';

export function LoginForm({ nextPath = '/dashboard' }: { nextPath?: string }) {
  const router = useRouter();
  const [login, setLogin] = useState('Nikki394t');
  const [password, setPassword] = useState('Tfz+3940');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login, password, remember_me: rememberMe })
      });
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[28px] border border-line/70 bg-panel/90 p-6 shadow-shell backdrop-blur xl:p-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">ServeOne</p>
        <h1 className="text-3xl font-semibold text-ink">Вход в систему</h1>
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
