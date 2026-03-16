'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiFetch, AuthResponse, ReportOverviewResponse, UserRecord } from '@/lib/api';

function formatDate(value: string | null, withTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
  }).format(new Date(value));
}

function roleLabel(role: string) {
  switch (role) {
    case 'creator':
      return 'Создатель';
    case 'admin':
      return 'Админ';
    case 'user':
      return 'Пользователь';
    default:
      return role;
  }
}

function StatCard({
  label,
  value,
  note,
  tone = 'default'
}: {
  label: string;
  value: string | number;
  note?: string;
  tone?: 'default' | 'brand' | 'accent';
}) {
  const toneClass =
    tone === 'brand'
      ? 'border-brand/20 bg-brandSoft text-brand'
      : tone === 'accent'
        ? 'border-accent/20 bg-accent/10 text-accent'
        : 'border-line bg-white text-ink';

  return (
    <div className={`metric-card ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      {note ? <p className="mt-2 text-sm leading-6 text-muted">{note}</p> : null}
    </div>
  );
}

export function ReportsManagement() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [report, setReport] = useState<ReportOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await apiFetch<AuthResponse>('/auth/me');
      setCurrentUser(me.user);
      if (me.user.role === 'user') {
        setReport(null);
        return;
      }
      const payload = await apiFetch<ReportOverviewResponse>('/reports/overview');
      setReport(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить отчёты');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const overallLoad = useMemo(() => {
    if (!report) return 0;
    return report.top_service_users.reduce((sum, item) => sum + item.total_load, 0);
  }, [report]);

  if (loading) {
    return (
      <section className="surface-card rounded-[30px] p-5 lg:p-6">
        <p className="text-sm text-muted">Загрузка отчётов...</p>
      </section>
    );
  }

  if (currentUser?.role === 'user') {
    return (
      <section className="surface-card rounded-[30px] p-5 lg:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Отчёты</p>
        <h2 className="mt-3 text-2xl font-semibold text-ink">Доступ ограничен</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
          Этот раздел доступен только `creator` и `admin`, потому что здесь собраны общекомандные метрики и служебная аналитика.
        </p>
      </section>
    );
  }

  if (!report) {
    return (
      <section className="surface-card rounded-[30px] p-5 lg:p-6">
        <p className="text-sm text-accent">{error || 'Отчёты пока недоступны'}</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="surface-card-strong rounded-[30px] p-5 lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Отчёты</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Операционная аналитика ServeOne</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
            Сводка строится по текущей базе: команда, ближайшее служение, дежурства, коммуникации, прогресс инструктажей и ближайшие дни рождения.
          </p>
          {error ? <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-accent">{error}</div> : null}
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <StatCard label="Активных участников" value={report.team.active_users} tone="brand" note={`Из ${report.team.total_users} сохранённых профилей`} />
            <StatCard label="Назначений на ближайшее служение" value={report.service.upcoming_assigned} note={`Свободных позиций: ${report.service.upcoming_unassigned}`} />
            <StatCard label="Суммарная загрузка" value={overallLoad} tone="accent" note="Назначения + напарники + активные фиксации" />
          </div>
        </div>

        <aside className="surface-card-dark rounded-[30px] p-5 text-white lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Сводка</p>
          <h3 className="mt-3 text-xl font-semibold">Ближайшее служение</h3>
          <div className="mt-5 grid gap-3 text-sm">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-white/60">Дата</p>
              <p className="mt-1 font-semibold">{formatDate(report.service.upcoming_service_date)}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-white/60">Week ID</p>
              <p className="mt-1 font-semibold">{report.service.upcoming_week_id}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-white/60">Сформирован отчёт</p>
              <p className="mt-1 font-semibold">{formatDate(report.generated_at, true)}</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Админы" value={report.team.admins} />
        <StatCard label="Push-подписок" value={report.team.push_subscriptions} />
        <StatCard label="Рассылки" value={report.communication.broadcast_campaigns} />
        <StatCard label="Прогресс чек-листов" value={`${report.instructions.current_week_completion_rate}%`} tone="brand" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="surface-card rounded-[30px] p-5 lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Команда и служение</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Ключевые показатели</h3>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <StatCard label="Всего позиций" value={report.service.total_positions} />
            <StatCard label="Активные фиксации" value={report.service.active_holds} />
            <StatCard label="Недель в системе" value={report.service.total_weeks} />
            <StatCard label="Завершённых недель" value={report.service.completed_weeks} />
            <StatCard label="Профили ДР" value={report.team.birthday_profiles} />
            <StatCard label="Создатели" value={report.team.creators} />
          </div>
        </div>

        <div className="surface-card rounded-[30px] p-5 lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Коммуникации</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Рассылки и сообщения</h3>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <StatCard label="Inbox сообщений" value={report.communication.inbox_messages} />
            <StatCard label="Непрочитано в inbox" value={report.communication.unread_inbox_messages} tone="accent" />
            <StatCard label="Личных сообщений" value={report.communication.direct_messages} />
            <StatCard label="Непрочитанных личных" value={report.communication.unread_direct_messages} tone="brand" />
            <StatCard label="Получателей рассылок" value={report.communication.broadcast_recipients} />
            <StatCard label="Всего кампаний" value={report.communication.broadcast_campaigns} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="surface-card rounded-[30px] p-5 lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Распределение</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Ближайшее служение по позициям</h3>
            </div>
            <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-muted">
              Партнёров: {report.service.upcoming_partners}
            </div>
          </div>
          <div className="mt-6 grid gap-3">
            {report.upcoming_assignments.map((assignment) => (
              <div key={assignment.position_name} className="metric-card">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">{assignment.position_name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {assignment.user_name || 'Не назначено'}
                      {assignment.partner_user_name ? ` · напарник: ${assignment.partner_user_name}` : ''}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-brand">
                    {assignment.hold_remaining ? `Фиксация ещё на ${assignment.hold_remaining}` : 'Без фиксации'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-card rounded-[30px] p-5 lg:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Нагрузка</p>
                <h3 className="mt-2 text-xl font-semibold text-ink">Топ по служениям</h3>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              {report.top_service_users.length === 0 ? (
                <div className="metric-card border-dashed p-4 text-sm text-muted">Назначений пока нет.</div>
              ) : (
                report.top_service_users.map((row, index) => (
                  <div key={row.user_id} className="metric-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{index + 1}. {row.display_name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">{roleLabel(row.role)}</p>
                      </div>
                      <div className="rounded-full bg-brandSoft px-3 py-1 text-xs font-semibold text-brand">
                        {row.total_load}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-muted">
                      Основных: {row.assignments_main} · Напарник: {row.assignments_partner} · Фиксаций: {row.hold_positions}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="surface-card rounded-[30px] p-5 lg:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Дни рождения</p>
                <h3 className="mt-2 text-xl font-semibold text-ink">Ближайшие даты</h3>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              {report.upcoming_birthdays.length === 0 ? (
                <div className="metric-card border-dashed p-4 text-sm text-muted">Дни рождения ещё не заполнены.</div>
              ) : (
                report.upcoming_birthdays.map((item) => (
                  <div key={item.user_id} className="metric-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{item.display_name}</p>
                        <p className="mt-1 text-sm text-muted">{formatDate(item.next_birthday)}</p>
                      </div>
                      <div className="rounded-full bg-brandSoft px-3 py-1 text-xs font-semibold text-brand">
                        {item.days_until} дн.
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="surface-card rounded-[30px] p-5 lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Коморка</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Очередь и история сдвигов</h3>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <StatCard label="В очереди" value={report.duty.queue_size} />
            <StatCard label="Сдвигов всего" value={report.duty.advances_total} />
            <StatCard label="Авто по понедельникам" value={report.duty.auto_advances} />
            <StatCard label="Ручных сдвигов" value={report.duty.manual_advances} />
          </div>
          <div className="metric-card text-sm leading-7 text-muted">
            Текущий: <span className="font-semibold text-ink">{report.duty.current_user_name || '—'}</span>
            <br />
            Следующий: <span className="font-semibold text-ink">{report.duty.next_user_name || '—'}</span>
            <br />
            Последний сдвиг: <span className="font-semibold text-ink">{formatDate(report.duty.last_advance_at, true)}</span>
          </div>
        </div>

        <div className="surface-card rounded-[30px] p-5 lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Чек-листы</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Прогресс инструктажей</h3>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <StatCard label="Инструкций" value={report.instructions.guides_total} />
            <StatCard label="Прогрессов всего" value={report.instructions.progress_records_total} />
            <StatCard label="На текущую неделю" value={report.instructions.current_week_progress_records} tone="brand" />
          </div>
          <div className="metric-card">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Заполнение чек-листов на текущую неделю</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-brandSoft">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${Math.max(4, Math.min(100, report.instructions.current_week_completion_rate))}%` }}
              />
            </div>
            <p className="mt-3 text-sm font-semibold text-ink">{report.instructions.current_week_completion_rate}%</p>
          </div>
          <div className="mt-6 grid gap-3">
            {report.recent_duty_history.map((item, index) => (
              <div key={`${item.advanced_at}-${index}`} className="metric-card">
                <p className="text-sm font-semibold text-ink">
                  {item.previous_user_name || '—'} → {item.current_user_name || '—'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {item.reason === 'auto' ? 'Авто' : item.reason === 'manual' ? 'Ручной' : item.reason}
                  {item.note ? ` · ${item.note}` : ''}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">{formatDate(item.advanced_at, true)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
