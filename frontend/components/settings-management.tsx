'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiFetch, AuthResponse, PushStateResponse, PushSubscriptionRecord, PushTestResponse, UserRecord } from '@/lib/api';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function shortUserAgent(userAgent: string | null) {
  if (!userAgent) return 'Без user-agent';
  if (userAgent.length <= 72) return userAgent;
  return `${userAgent.slice(0, 72)}…`;
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  const displayMode = window.matchMedia?.('(display-mode: standalone)').matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(displayMode || iosStandalone);
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function getBrowserSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export function SettingsManagement() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [pushState, setPushState] = useState<PushStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [installAvailable, setInstallAvailable] = useState(false);
  const [standalone, setStandalone] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, state] = await Promise.all([
        apiFetch<AuthResponse>('/auth/me'),
        apiFetch<PushStateResponse>('/push/state')
      ]);
      setCurrentUser(me.user);
      setPushState(state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  }, []);

  const syncBrowserState = useCallback(() => {
    if (typeof window === 'undefined') return;
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    setInstallAvailable(Boolean(window.__serveoneDeferredPrompt));
    setStandalone(isStandaloneMode());
  }, []);

  useEffect(() => {
    void loadData();
    syncBrowserState();
  }, [loadData, syncBrowserState]);

  useEffect(() => {
    const handler = () => syncBrowserState();
    window.addEventListener('serveone:install-available', handler);
    window.addEventListener('serveone:install-unavailable', handler);
    window.addEventListener('serveone:installed', handler);
    return () => {
      window.removeEventListener('serveone:install-available', handler);
      window.removeEventListener('serveone:install-unavailable', handler);
      window.removeEventListener('serveone:installed', handler);
    };
  }, [syncBrowserState]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const serviceWorkerSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator;
  const pushSupported = typeof window !== 'undefined' && 'PushManager' in window;

  const activeSubscription = useMemo<PushSubscriptionRecord | null>(() => {
    if (!pushState?.subscriptions.length) return null;
    return pushState.subscriptions[0];
  }, [pushState?.subscriptions]);

  async function requestPermission() {
    if (!('Notification' in window)) {
      setError('Этот браузер не поддерживает системные уведомления');
      return;
    }
    setBusyKey('permission');
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        setSuccess('Разрешение на уведомления выдано');
      } else {
        setError('Браузер не разрешил push-уведомления');
      }
    } finally {
      setBusyKey(null);
    }
  }

  async function subscribePush() {
    if (!pushState?.enabled || !pushState.public_key) {
      setError('Push-уведомления не настроены на сервере');
      return;
    }
    if (!serviceWorkerSupported || !pushSupported) {
      setError('Этот браузер не поддерживает push-уведомления');
      return;
    }

    setBusyKey('subscribe');
    setError(null);
    try {
      let permission = notificationPermission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
        setNotificationPermission(permission);
      }
      if (permission !== 'granted') {
        throw new Error('Нужно разрешить браузеру показывать уведомления');
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(pushState.public_key)
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('Браузер вернул неполную push-подписку');
      }

      const nextState = await apiFetch<PushStateResponse>('/push/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: {
            p256dh: json.keys.p256dh,
            auth: json.keys.auth
          },
          user_agent: navigator.userAgent
        })
      });
      setPushState(nextState);
      setSuccess('Push-уведомления включены на этом устройстве');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось включить push-уведомления');
    } finally {
      setBusyKey(null);
    }
  }

  async function unsubscribePush() {
    setBusyKey('unsubscribe');
    setError(null);
    try {
      const browserSubscription = await getBrowserSubscription();
      const endpoint = browserSubscription?.endpoint || activeSubscription?.endpoint;
      if (!endpoint) {
        throw new Error('Активная push-подписка на этом устройстве не найдена');
      }
      if (browserSubscription) {
        await browserSubscription.unsubscribe();
      }
      const nextState = await apiFetch<PushStateResponse>('/push/subscriptions/remove', {
        method: 'POST',
        body: JSON.stringify({ endpoint })
      });
      setPushState(nextState);
      setSuccess('Push-уведомления на этом устройстве отключены');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отключить push-уведомления');
    } finally {
      setBusyKey(null);
    }
  }

  async function sendTestNotification() {
    setBusyKey('test');
    setError(null);
    try {
      const result = await apiFetch<PushTestResponse>('/push/test', {
        method: 'POST',
        body: JSON.stringify({
          title: 'ServeOne',
          body: 'Тестовое push-уведомление. Если ты его видишь, канал работает.',
          url: '/dashboard/messages'
        })
      });
      setPushState((current) =>
        current
          ? {
              ...current,
              subscription_count: result.subscriptions.length,
              subscriptions: result.subscriptions
            }
          : current
      );
      setSuccess(`Тест отправлен: ${result.sent}, удалено подписок: ${result.removed}, ошибок: ${result.failed}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить тестовое уведомление');
    } finally {
      setBusyKey(null);
    }
  }

  async function installApp() {
    const promptEvent = window.__serveoneDeferredPrompt;
    if (!promptEvent) {
      setError('Этот браузер не предоставил системный install prompt');
      return;
    }
    setBusyKey('install');
    setError(null);
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      window.__serveoneDeferredPrompt = null;
      syncBrowserState();
    } finally {
      setBusyKey(null);
    }
  }

  if (loading || !pushState || !currentUser) {
    return (
      <section className="surface-card rounded-[30px] p-5 lg:p-6">
        <p className="text-sm text-muted">Загрузка настроек...</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="surface-card rounded-[30px] p-5 lg:p-6">
          <span className="dashboard-chip">Настройки</span>
          <h2 className="mt-3 text-2xl font-semibold text-ink">Устройство, вход и уведомления</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
            Здесь включается PWA-режим: установка приложения, системные push-уведомления и проверка текущей подписки устройства.
          </p>

          {error ? <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-accent">{error}</div> : null}
          {success ? <div className="mt-4 rounded-2xl border border-brand/20 bg-brandSoft px-4 py-3 text-sm text-brand">{success}</div> : null}

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="metric-card">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Пользователь</p>
              <p className="mt-3 text-lg font-semibold text-ink">{currentUser.full_name || currentUser.login}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted">{currentUser.role}</p>
            </div>
            <div className="metric-card">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Установка</p>
              <p className="mt-3 text-lg font-semibold text-ink">
                {standalone ? 'Установлено' : installAvailable ? 'Готово к установке' : 'Через браузер'}
              </p>
            </div>
            <div className="metric-card">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Push-подписки</p>
              <p className="mt-3 text-lg font-semibold text-brand">{pushState.subscription_count}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted">
                {pushState.enabled ? 'Сервер настроен' : 'Сервер не настроен'}
              </p>
            </div>
          </div>
        </div>

        <aside className="surface-card-dark rounded-[30px] p-5 text-white lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">PWA</p>
          <h3 className="mt-3 text-xl font-semibold">Установка на рабочий стол</h3>
          <p className="mt-3 text-sm leading-7 text-white/75">
            После установки приложение открывается без рамок браузера. На iPhone, если кнопка недоступна, используй системное меню «Поделиться → На экран Домой».
          </p>
          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => void installApp()}
              disabled={busyKey !== null || standalone || !installAvailable}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#18304f] transition hover:bg-[#edf2f7] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {standalone ? 'Приложение уже установлено' : 'Установить приложение'}
            </button>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm leading-7 text-white/80">
              {installAvailable
                ? 'Браузер разрешил install prompt. Можно ставить ярлык на рабочий стол.'
                : 'Если браузер не дал install prompt, установка всё равно доступна через штатное меню браузера.'}
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="surface-card rounded-[30px] p-5 lg:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="dashboard-chip">Push</span>
              <h3 className="mt-3 text-xl font-semibold text-ink">Системные уведомления</h3>
            </div>
            <div className="rounded-2xl border border-line/70 bg-white/80 px-4 py-3 text-sm font-semibold text-muted">
              Permission: {notificationPermission}
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="metric-card">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Service Worker</p>
              <p className="mt-3 text-lg font-semibold text-ink">{serviceWorkerSupported ? 'Да' : 'Нет'}</p>
            </div>
            <div className="metric-card">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Push API</p>
              <p className="mt-3 text-lg font-semibold text-ink">{pushSupported ? 'Да' : 'Нет'}</p>
            </div>
            <div className="metric-card">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Сервер</p>
              <p className="mt-3 text-lg font-semibold text-ink">{pushState.enabled ? 'Готов' : 'Не настроен'}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void requestPermission()}
              disabled={busyKey !== null || notificationPermission === 'granted'}
              className="rounded-2xl border border-line/70 bg-white/80 px-4 py-3 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              Разрешить уведомления
            </button>
            <button
              type="button"
              onClick={() => void subscribePush()}
              disabled={busyKey !== null || !pushState.enabled}
              className="rounded-2xl bg-[#18304f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#224266] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Включить push на этом устройстве
            </button>
            <button
              type="button"
              onClick={() => void unsubscribePush()}
              disabled={busyKey !== null || pushState.subscription_count === 0}
              className="rounded-2xl border border-line/70 bg-white/80 px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              Отключить на этом устройстве
            </button>
            <button
              type="button"
              onClick={() => void sendTestNotification()}
              disabled={busyKey !== null || pushState.subscription_count === 0}
              className="rounded-2xl border border-brand/25 bg-brandSoft px-4 py-3 text-sm font-semibold text-brand transition hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              Отправить тестовое уведомление
            </button>
          </div>

          <div className="mt-6 rounded-[24px] border border-dashed border-line/70 bg-white/72 p-4 text-sm leading-7 text-muted">
            Push-канал уже подключён к модулю <span className="font-semibold text-ink">Сообщения</span> и{' '}
            <span className="font-semibold text-ink">Рассылки</span>. После включения подписки приложение сможет присылать реальные уведомления о новых сообщениях и отправках.
          </div>
        </div>

        <div className="surface-card rounded-[30px] p-5 lg:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="dashboard-chip">Подписки</span>
              <h3 className="mt-3 text-xl font-semibold text-ink">Активные устройства</h3>
            </div>
            <div className="rounded-2xl border border-line/70 bg-white/80 px-4 py-3 text-sm font-semibold text-muted">
              {pushState.subscription_count} шт.
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {pushState.subscriptions.length === 0 ? (
              <div className="surface-card-strong rounded-[24px] border border-dashed border-line/70 p-4 text-sm text-muted">
                Активных push-подписок пока нет.
              </div>
            ) : (
              pushState.subscriptions.map((subscription) => (
                <div key={subscription.id} className="surface-card-strong rounded-[24px] p-4">
                  <p className="text-sm font-semibold text-ink">Подписка #{subscription.id}</p>
                  <p className="mt-2 break-all text-xs leading-6 text-muted">{subscription.endpoint}</p>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-muted">{shortUserAgent(subscription.user_agent)}</p>
                  <p className="mt-2 text-xs text-muted">Обновлено: {formatDate(subscription.updated_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
