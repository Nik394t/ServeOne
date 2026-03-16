'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiFetch, AuthResponse, DutyOverviewResponse, UserRecord } from '@/lib/api';

function formatUserName(user: UserRecord | null | undefined) {
  if (!user) return 'Не назначен';
  return user.full_name || user.login;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function DutyManagement() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [overview, setOverview] = useState<DutyOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManage = currentUser?.role === 'creator' || currentUser?.role === 'admin';

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [me, duty] = await Promise.all([
        apiFetch<AuthResponse>('/auth/me'),
        apiFetch<DutyOverviewResponse>('/duty')
      ]);
      setCurrentUser(me.user);
      setOverview(duty);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить дежурства');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 2500);
    return () => window.clearTimeout(timer);
  }, [success]);

  const queueUserIds = useMemo(() => new Set((overview?.queue || []).map((member) => member.user_id)), [overview?.queue]);

  const availableUsers = useMemo(
    () =>
      (overview?.users || []).filter((user) => user.is_active && user.role !== 'deleted' && !queueUserIds.has(user.id)),
    [overview?.users, queueUserIds]
  );

  const myQueuePosition = useMemo(() => {
    if (!currentUser || !overview) return null;
    return overview.queue.findIndex((member) => member.user_id === currentUser.id);
  }, [currentUser, overview]);

  async function runAction(key: string, action: () => Promise<void>, successMessage: string) {
    setBusyKey(key);
    setError(null);
    try {
      await action();
      setSuccess(successMessage);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Операция не выполнена');
    } finally {
      setBusyKey(null);
    }
  }

  async function addMember() {
    if (!selectedUserId) return;
    await runAction(
      `add:${selectedUserId}`,
      () =>
        apiFetch<DutyOverviewResponse>('/duty/members', {
          method: 'POST',
          body: JSON.stringify({ user_id: Number(selectedUserId) })
        }).then(() => undefined),
      'Участник добавлен в очередь'
    );
    setSelectedUserId('');
  }

  async function moveMember(memberId: number, direction: 'up' | 'down') {
    await runAction(
      `move:${memberId}:${direction}`,
      () =>
        apiFetch<DutyOverviewResponse>(`/duty/members/${memberId}/move`, {
          method: 'POST',
          body: JSON.stringify({ direction })
        }).then(() => undefined),
      'Очередь обновлена'
    );
  }

  async function removeMember(memberId: number, name: string) {
    if (!window.confirm(`Убрать ${name} из очереди дежурств?`)) return;
    await runAction(
      `remove:${memberId}`,
      () => apiFetch<DutyOverviewResponse>(`/duty/members/${memberId}`, { method: 'DELETE' }).then(() => undefined),
      'Участник удалён из очереди'
    );
  }

  async function advanceQueue() {
    if (!window.confirm('Сдвинуть очередь на следующего дежурного?')) return;
    await runAction(
      'advance',
      () => apiFetch('/duty/advance', { method: 'POST' }).then(() => undefined),
      'Очередь сдвинута'
    );
  }

  if (loading || !overview) {
    return (
      <section className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
        <p className="text-sm text-muted">Загрузка дежурств...</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Дежурства</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Очередь коморки</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                Очередь ведётся централизованно. По понедельникам система сдвигает её автоматически один раз.
              </p>
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={() => void advanceQueue()}
                disabled={busyKey !== null || overview.queue.length === 0}
                className="rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1f4f92] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Следующий дежурный
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-accent">{error}</div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-2xl border border-brand/20 bg-brandSoft px-4 py-3 text-sm text-brand">{success}</div>
          ) : null}

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Сейчас дежурит</p>
              <p className="mt-2 text-lg font-semibold text-ink">{overview.current_user_name || 'Очередь пустая'}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Следующий</p>
              <p className="mt-2 text-lg font-semibold text-ink">{overview.next_user_name || '—'}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Автосдвиг</p>
              <p className="mt-2 text-lg font-semibold text-ink">{formatDate(overview.last_auto_advance)}</p>
            </div>
          </div>
        </div>

        <aside className="rounded-[28px] border border-line/70 bg-[#18304f] p-5 text-white shadow-panel lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Мой статус</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
              <p className="text-sm text-white/74">Моё место в очереди</p>
              <p className="mt-2 text-xl font-semibold">
                {myQueuePosition === null || myQueuePosition < 0 ? 'Не в очереди' : `${myQueuePosition + 1}`}
              </p>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
              <p className="text-sm text-white/74">Текущий дежурный</p>
              <p className="mt-2 text-xl font-semibold">{overview.current_user_name || '—'}</p>
            </div>
          </div>
        </aside>
      </section>

      {canManage ? (
        <section className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Управление очередью</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Добавить участника</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] xl:min-w-[520px]">
              <select
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                disabled={busyKey !== null}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Выберите пользователя</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {formatUserName(user)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void addMember()}
                disabled={busyKey !== null || !selectedUserId}
                className="rounded-2xl border border-brand/20 bg-brandSoft px-4 py-3 text-sm font-semibold text-brand transition hover:border-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Добавить в очередь
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Очередь</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Текущее распределение</h3>
            </div>
            <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-muted">
              {overview.queue.length} в очереди
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {overview.queue.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-white p-4 text-sm text-muted">
                Очередь пока пустая.
              </div>
            ) : (
              overview.queue.map((member, index) => {
                const isCurrent = overview.current_user_id === member.user_id;
                const isNext = overview.next_user_id === member.user_id && overview.current_user_id !== member.user_id;
                return (
                  <div
                    key={member.id}
                    className={`rounded-2xl border p-4 ${isCurrent ? 'border-brand/30 bg-brandSoft/50' : 'border-line bg-white'}`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted">Позиция в очереди</p>
                        <h4 className="mt-1 text-lg font-semibold text-ink">{index + 1}. {formatUserName(member.user)}</h4>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                          {isCurrent ? <span className="rounded-full bg-brand px-3 py-1 text-white">Текущий</span> : null}
                          {isNext ? <span className="rounded-full bg-[#18304f] px-3 py-1 text-white">Следующий</span> : null}
                        </div>
                      </div>

                      {canManage ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void moveMember(member.id, 'up')}
                            disabled={busyKey !== null || index === 0}
                            className="rounded-2xl border border-line bg-panel px-4 py-2 text-sm font-semibold text-ink transition hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Вверх
                          </button>
                          <button
                            type="button"
                            onClick={() => void moveMember(member.id, 'down')}
                            disabled={busyKey !== null || index === overview.queue.length - 1}
                            className="rounded-2xl border border-line bg-panel px-4 py-2 text-sm font-semibold text-ink transition hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Вниз
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeMember(member.id, formatUserName(member.user))}
                            disabled={busyKey !== null}
                            className="rounded-2xl border border-accent/25 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition hover:border-accent/45 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Удалить
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <aside className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">История</p>
          <h3 className="mt-2 text-xl font-semibold text-ink">Последние сдвиги</h3>
          <div className="mt-6 space-y-3">
            {overview.history.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-white p-4 text-sm text-muted">
                Пока нет истории переключений.
              </div>
            ) : (
              overview.history.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {entry.previous_user_name || '—'} → {entry.current_user_name || '—'}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted">{entry.note || 'Сдвиг очереди дежурств'}</p>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.reason === 'auto' ? 'bg-brandSoft text-brand' : 'bg-[#18304f] text-white'}`}>
                      {entry.reason === 'auto' ? 'Авто' : 'Ручной'}
                    </div>
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted">{formatDateTime(entry.advanced_at)}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
