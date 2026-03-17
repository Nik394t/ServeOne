'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiFetch, AssignmentRecord, AuthResponse, ScheduleWeekResponse, UserRecord } from '@/lib/api';

type HoldDraft = {
  user_id: string;
  remaining: string;
};

function buildHoldDraftState(week: ScheduleWeekResponse): Record<number, HoldDraft> {
  const nextDrafts: Record<number, HoldDraft> = {};
  for (const assignment of week.assignments) {
    nextDrafts[assignment.position_id] = {
      user_id: String(assignment.hold?.user_id ?? assignment.user_id ?? ''),
      remaining: String(assignment.hold?.remaining ?? 1)
    };
  }
  return nextDrafts;
}

function formatServiceDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value));
}

function formatUserName(user: UserRecord | undefined) {
  if (!user) return 'Не назначен';
  return user.full_name || user.login;
}

function fieldClass() {
  return 'w-full rounded-2xl border border-line/70 bg-white/80 px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:bg-white disabled:cursor-not-allowed disabled:opacity-60';
}

export function ScheduleManagement() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [schedule, setSchedule] = useState<ScheduleWeekResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [holdDrafts, setHoldDrafts] = useState<Record<number, HoldDraft>>({});

  const canManage = currentUser?.role === 'creator' || currentUser?.role === 'admin';

  const applyScheduleWeek = useCallback((week: ScheduleWeekResponse) => {
    setSchedule(week);
    setHoldDrafts(buildHoldDraftState(week));
  }, []);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    }
    setError(null);
    try {
      const [me, week] = await Promise.all([
        apiFetch<AuthResponse>('/auth/me'),
        apiFetch<ScheduleWeekResponse>('/schedule/upcoming')
      ]);
      setCurrentUser(me.user);
      applyScheduleWeek(week);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить расписание');
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, [applyScheduleWeek]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 2500);
    return () => window.clearTimeout(timer);
  }, [success]);

  const userMap = useMemo(() => {
    const map = new Map<number, UserRecord>();
    for (const user of schedule?.users || []) {
      map.set(user.id, user);
    }
    return map;
  }, [schedule?.users]);

  const myAssignments = useMemo(() => {
    if (!currentUser || !schedule) return [] as AssignmentRecord[];
    return schedule.assignments.filter(
      (assignment) => assignment.user_id === currentUser.id || assignment.partner_user_id === currentUser.id
    );
  }, [currentUser, schedule]);

  async function runAction<T>(
    key: string,
    action: () => Promise<T>,
    successMessage: string,
    options?: { afterSuccess?: (result: T) => Promise<void> | void }
  ) {
    setBusyKey(key);
    setError(null);
    try {
      const result = await action();
      if (options?.afterSuccess) {
        await options.afterSuccess(result);
      }
      setSuccess(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Операция не выполнена');
    } finally {
      setBusyKey(null);
    }
  }

  async function updateMain(assignmentId: number, value: string) {
    await runAction(
      `main:${assignmentId}`,
      () =>
        apiFetch<ScheduleWeekResponse>(`/schedule/assignments/${assignmentId}`, {
          method: 'PATCH',
          body: JSON.stringify({ user_id: value ? Number(value) : null })
        }),
      'Основное назначение обновлено',
      { afterSuccess: applyScheduleWeek }
    );
  }

  async function updatePartner(assignmentId: number, value: string) {
    await runAction(
      `partner:${assignmentId}`,
      () =>
        apiFetch<ScheduleWeekResponse>(`/schedule/assignments/${assignmentId}/partner`, {
          method: 'PATCH',
          body: JSON.stringify({ partner_user_id: value ? Number(value) : null })
        }),
      'Напарник обновлён',
      { afterSuccess: applyScheduleWeek }
    );
  }

  async function saveHold(positionId: number) {
    const draft = holdDrafts[positionId];
    await runAction(
      `hold:${positionId}`,
      () =>
        apiFetch<ScheduleWeekResponse>('/schedule/holds', {
          method: 'POST',
          body: JSON.stringify({
            position_id: positionId,
            user_id: Number(draft.user_id),
            remaining: Number(draft.remaining)
          })
        }),
      'Фиксация сохранена',
      { afterSuccess: applyScheduleWeek }
    );
  }

  async function clearHold(holdId: number) {
    await runAction(
      `hold-clear:${holdId}`,
      () => apiFetch<ScheduleWeekResponse>(`/schedule/holds/${holdId}`, { method: 'DELETE' }),
      'Фиксация снята',
      { afterSuccess: applyScheduleWeek }
    );
  }

  async function completeWeek() {
    if (!schedule) return;
    if (!window.confirm('Завершить текущее служение и уменьшить счётчики фиксации?')) return;
    await runAction(
      `complete:${schedule.week_id}`,
      () =>
        apiFetch<{ status: string; week_id: string }>(`/schedule/weeks/${schedule.week_id}/complete`, {
          method: 'POST'
        }),
      'Служение завершено',
      { afterSuccess: async () => await loadData(false) }
    );
  }

  if (loading || !schedule) {
    return (
      <section className="surface-card rounded-[24px] p-4 sm:rounded-[30px] sm:p-5 lg:p-6">
        <p className="text-sm text-muted">Загрузка расписания...</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="surface-card rounded-[24px] p-4 sm:rounded-[30px] sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <span className="dashboard-chip">Служение</span>
              <h2 className="mt-3 text-xl font-semibold capitalize text-ink sm:text-2xl">{formatServiceDate(schedule.service_date)}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                Неделя {schedule.week_id}. Здесь управляются позиции, напарники и фиксация человека на несколько служений подряд.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div
                className={`inline-flex items-center rounded-2xl px-4 py-3 text-sm font-semibold ${
                  schedule.is_completed ? 'bg-brandSoft text-brand' : 'border border-line/70 bg-white/80 text-ink'
                }`}
              >
                {schedule.is_completed ? 'Неделя завершена' : 'Неделя активна'}
              </div>
              {canManage ? (
                <button
                  type="button"
                  onClick={completeWeek}
                  disabled={busyKey !== null || schedule.is_completed}
                  className="rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1f4f92] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Завершить служение
                </button>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-accent">{error}</div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-2xl border border-brand/20 bg-brandSoft px-4 py-3 text-sm text-brand">{success}</div>
          ) : null}
        </div>

        <aside className="surface-card-dark rounded-[24px] p-4 text-white sm:rounded-[30px] sm:p-5 lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Моё участие</p>
          {myAssignments.length === 0 ? (
            <p className="mt-4 text-sm leading-7 text-white/76">На текущую неделю для тебя пока нет позиции.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {myAssignments.map((assignment) => (
                <div key={assignment.id} className="rounded-2xl border border-white/12 bg-white/8 p-3.5 sm:p-4">
                  <p className="text-sm font-semibold">{assignment.position_name}</p>
                  <p className="mt-2 text-sm text-white/74">
                    {assignment.user_id === currentUser?.id ? 'Основной служитель' : 'Напарник'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </section>

      <section className="grid gap-4 2xl:grid-cols-2">
        {schedule.assignments.map((assignment) => {
          const mainUser = assignment.user_id ? userMap.get(assignment.user_id) : undefined;
          const partnerUser = assignment.partner_user_id ? userMap.get(assignment.partner_user_id) : undefined;
          const holdDraft = holdDrafts[assignment.position_id] || { user_id: '', remaining: '1' };
          const isHeld = Boolean(assignment.hold);
          const isMine = currentUser && (assignment.user_id === currentUser.id || assignment.partner_user_id === currentUser.id);

          return (
            <div
              key={assignment.id}
              className={`rounded-[24px] p-4 sm:rounded-[30px] sm:p-5 lg:p-6 ${
                isMine ? 'surface-card-strong ring-1 ring-brand/20' : 'surface-card'
              }`}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <span className="dashboard-chip">Позиция</span>
                  <h3 className="mt-3 text-xl font-semibold text-ink sm:text-2xl">{assignment.position_name}</h3>
                  <div className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-2">
                    <div className="rounded-2xl border border-line/60 bg-white/70 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted/80">Основной</p>
                      <p className="mt-1.5 text-sm font-semibold text-ink">{formatUserName(mainUser)}</p>
                    </div>
                    <div className="rounded-2xl border border-line/60 bg-white/70 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted/80">Напарник</p>
                      <p className="mt-1.5 text-sm font-semibold text-ink">{formatUserName(partnerUser)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isHeld ? (
                    <div className="rounded-2xl bg-accent/10 px-4 py-3 text-sm font-semibold text-accent">
                      Закрепление: ещё {assignment.hold?.remaining}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-line/70 bg-white/80 px-4 py-3 text-sm font-semibold text-muted">
                      Без фиксации
                    </div>
                  )}
                </div>
              </div>

              {canManage ? (
                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-line/65 bg-white/68 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Назначения</p>
                    <div className="mt-4 grid gap-3">
                      <label className="space-y-2">
                        <span className="text-sm text-muted">Основной служитель</span>
                        <select
                          value={assignment.user_id ?? ''}
                          onChange={(event) => void updateMain(assignment.id, event.target.value)}
                          disabled={busyKey !== null || schedule.is_completed}
                          className={fieldClass()}
                        >
                          <option value="">Не назначен</option>
                          {schedule.users.filter((user) => user.role !== 'deleted' && user.is_active).map((user) => (
                            <option key={user.id} value={user.id}>
                              {formatUserName(user)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm text-muted">Напарник</span>
                        <select
                          value={assignment.partner_user_id ?? ''}
                          onChange={(event) => void updatePartner(assignment.id, event.target.value)}
                          disabled={busyKey !== null || schedule.is_completed}
                          className={fieldClass()}
                        >
                          <option value="">Без напарника</option>
                          {schedule.users
                            .filter((user) => user.role !== 'deleted' && user.is_active && user.id !== assignment.user_id)
                            .map((user) => (
                              <option key={user.id} value={user.id}>
                                {formatUserName(user)}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-line/65 bg-white/68 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Фиксация на N служений</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px]">
                      <label className="space-y-2">
                        <span className="text-sm text-muted">Кого закрепить</span>
                        <select
                          value={holdDraft.user_id}
                          onChange={(event) =>
                            setHoldDrafts((state) => ({ ...state, [assignment.position_id]: { ...holdDraft, user_id: event.target.value } }))
                          }
                          disabled={busyKey !== null || schedule.is_completed}
                          className={fieldClass()}
                        >
                          <option value="">Выберите пользователя</option>
                          {schedule.users.filter((user) => user.role !== 'deleted' && user.is_active).map((user) => (
                            <option key={user.id} value={user.id}>
                              {formatUserName(user)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm text-muted">Служений</span>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={holdDraft.remaining}
                          onChange={(event) =>
                            setHoldDrafts((state) => ({ ...state, [assignment.position_id]: { ...holdDraft, remaining: event.target.value } }))
                          }
                          disabled={busyKey !== null || schedule.is_completed}
                          className={fieldClass()}
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => void saveHold(assignment.position_id)}
                        disabled={!holdDraft.user_id || busyKey !== null || schedule.is_completed}
                        className="rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1f4f92] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Закрепить
                      </button>
                      {assignment.hold ? (
                        <button
                          type="button"
                          onClick={() => void clearHold(assignment.hold!.id)}
                          disabled={busyKey !== null || schedule.is_completed}
                          className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Снять фиксацию
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}
