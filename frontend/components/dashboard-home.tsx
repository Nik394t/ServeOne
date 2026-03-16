'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  apiFetch,
  AuthResponse,
  BirthdayCollectionResponse,
  InstructionCollectionResponse,
  MessageCollectionResponse,
  ReportOverviewResponse,
  ScheduleWeekResponse,
  UserRecord
} from '@/lib/api';

type UserDashboardPayload = {
  schedule: ScheduleWeekResponse;
  instructions: InstructionCollectionResponse;
  messages: MessageCollectionResponse;
  birthdays: BirthdayCollectionResponse;
};

function formatDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
  }).format(new Date(value));
}

function roleLabel(role: UserRecord['role']) {
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

function QuickLink({
  href,
  title,
  body,
  tone = 'default'
}: {
  href: string;
  title: string;
  body: string;
  tone?: 'default' | 'dark';
}) {
  return (
    <Link
      href={href}
      className={
        tone === 'dark'
          ? 'rounded-[24px] border border-white/12 bg-white/10 p-4 transition hover:-translate-y-0.5 hover:bg-white/15'
          : 'metric-card transition hover:-translate-y-0.5 hover:border-brand hover:bg-brandSoft/40'
      }
    >
      <p className={`text-sm font-semibold ${tone === 'dark' ? 'text-white' : 'text-ink'}`}>{title}</p>
      <p className={`mt-2 text-sm leading-6 ${tone === 'dark' ? 'text-white/72' : 'text-muted'}`}>{body}</p>
    </Link>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-4 overflow-hidden rounded-full bg-brandSoft/70">
      <div
        className="h-2.5 rounded-full bg-[linear-gradient(90deg,_#285ea8,_#5e8fdd)] transition-all"
        style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function DashboardHome() {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [userPayload, setUserPayload] = useState<UserDashboardPayload | null>(null);
  const [reportPayload, setReportPayload] = useState<ReportOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await apiFetch<AuthResponse>('/auth/me');
      setUser(me.user);

      if (me.user.role === 'user') {
        const [schedule, instructions, messages, birthdays] = await Promise.all([
          apiFetch<ScheduleWeekResponse>('/schedule/upcoming'),
          apiFetch<InstructionCollectionResponse>('/instructions'),
          apiFetch<MessageCollectionResponse>('/messages'),
          apiFetch<BirthdayCollectionResponse>('/birthdays')
        ]);
        setUserPayload({ schedule, instructions, messages, birthdays });
        setReportPayload(null);
      } else {
        const report = await apiFetch<ReportOverviewResponse>('/reports/overview');
        setReportPayload(report);
        setUserPayload(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить главную страницу');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const myAssignments = useMemo(() => {
    if (!user || !userPayload) return [];
    return userPayload.schedule.assignments
      .filter((assignment) => assignment.user_id === user.id || assignment.partner_user_id === user.id)
      .map((assignment) => ({
        ...assignment,
        mode: assignment.user_id === user.id ? 'main' : 'partner'
      }));
  }, [user, userPayload]);

  const myInstructions = useMemo(() => {
    if (!userPayload) return [];
    return userPayload.instructions.items.filter((item) => item.assigned_to_me);
  }, [userPayload]);

  const checklistStats = useMemo(() => {
    if (!myInstructions.length) {
      return { checked: 0, total: 0, percent: 0 };
    }
    const total = myInstructions.reduce((sum, item) => sum + item.checklist.length, 0);
    const checked = myInstructions.reduce((sum, item) => sum + item.checked_item_ids.length, 0);
    return {
      checked,
      total,
      percent: total ? Math.round((checked / total) * 100) : 0
    };
  }, [myInstructions]);

  if (loading) {
    return (
      <section className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
        <p className="text-sm text-muted">Загрузка главной страницы...</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
        <p className="text-sm text-accent">{error || 'Профиль пользователя не найден'}</p>
      </section>
    );
  }

  if (user.role === 'user' && userPayload) {
    const nearestBirthdays = userPayload.birthdays.people.slice(0, 3);

    return (
      <div className="space-y-4">
        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="surface-card-strong rounded-[30px] p-5 lg:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Моя неделя</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink">Ближайшее служение</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
              Дата: {formatDate(userPayload.schedule.service_date)}. Здесь собрана твоя личная сводка: назначения, чек-листы и непрочитанные сообщения.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <StatCard label="Назначений" value={myAssignments.length} tone="brand" note={myAssignments.length ? 'Проверь позиции ниже' : 'Пока без назначений'} />
              <StatCard label="Непрочитанных сообщений" value={userPayload.messages.unread_count} note="Личные и системные" />
              <StatCard label="Чек-листы" value={`${checklistStats.percent}%`} tone="accent" note={`${checklistStats.checked} из ${checklistStats.total} пунктов`} />
            </div>
          </div>

          <aside className="surface-card-dark rounded-[30px] p-5 text-white lg:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Быстрые действия</p>
            <div className="mt-5 grid gap-3">
              <QuickLink href="/dashboard/messages" title="Открыть сообщения" body="Посмотри входящие и ответы администраторов." tone="dark" />
              <QuickLink href="/dashboard/instructions" title="Открыть инструктажи" body="Пройди чек-листы по своим позициям." tone="dark" />
              <QuickLink href="/dashboard/settings" title="Настройки устройства" body="Установи приложение и включи push." tone="dark" />
            </div>
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="surface-card rounded-[30px] p-5 lg:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Мои позиции</p>
                <h3 className="mt-2 text-xl font-semibold text-ink">Назначения на ближайшее служение</h3>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              {myAssignments.length === 0 ? (
                <div className="metric-card border-dashed p-4 text-sm leading-7 text-muted">
                  Пока нет назначений. Когда администратор распределит позиции, эта карточка обновится автоматически.
                </div>
              ) : (
                myAssignments.map((assignment) => (
                  <div key={assignment.id} className="metric-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{assignment.position_name}</p>
                        <p className="mt-1 text-sm text-muted">
                          {assignment.mode === 'main' ? 'Основной служитель' : 'Напарник'}
                        </p>
                      </div>
                      <div className="rounded-full bg-brandSoft px-3 py-1 text-xs font-semibold text-brand">
                        {assignment.hold ? `Фиксация: ${assignment.hold.remaining}` : 'Ротация'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="surface-card rounded-[30px] p-5 lg:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Чек-листы</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Мои инструктажи</h3>
              <ProgressBar value={checklistStats.percent} />
              <div className="mt-6 grid gap-3">
                {myInstructions.length === 0 ? (
                  <div className="metric-card border-dashed p-4 text-sm text-muted">
                    На эту неделю для тебя нет активных инструктажей.
                  </div>
                ) : (
                  myInstructions.map((item) => (
                    <div key={item.id} className="metric-card">
                      <p className="text-sm font-semibold text-ink">{item.position_name}</p>
                      <p className="mt-2 text-sm leading-7 text-muted">
                        Выполнено {item.checked_item_ids.length} из {item.checklist.length} пунктов
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="surface-card rounded-[30px] p-5 lg:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Команда</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Ближайшие дни рождения</h3>
              <div className="mt-6 grid gap-3">
                {nearestBirthdays.length === 0 ? (
                  <div className="metric-card border-dashed p-4 text-sm text-muted">
                    Дни рождения пока не заполнены.
                  </div>
                ) : (
                  nearestBirthdays.map((item) => (
                    <div key={item.user.id} className="metric-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{item.user.full_name || item.user.login}</p>
                          <p className="mt-1 text-sm text-muted">{item.next_birthday ? formatDate(item.next_birthday) : 'Дата не указана'}</p>
                        </div>
                        <div className="rounded-full bg-brandSoft px-3 py-1 text-xs font-semibold text-brand">
                          {item.days_until ?? '—'} дн.
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!reportPayload) {
    return (
      <section className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
        <p className="text-sm text-accent">{error || 'Не удалось построить сводку'}</p>
      </section>
    );
  }

  const isCreator = user.role === 'creator';

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="surface-card-strong rounded-[30px] p-5 lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">
            {isCreator ? 'Управление системой' : 'Операционная смена'}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">
            {isCreator ? 'Сводка создателя' : 'Сводка администратора'}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
            {isCreator
              ? 'На главной собраны системные показатели: команда, служения, push-канал, коммуникации и ближайшие точки внимания.'
              : 'На главной собрана рабочая сводка по ближайшему служению: незакрытые позиции, дежурства, чек-листы и ближайшие дни рождения.'}
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <StatCard
              label={isCreator ? 'Всего пользователей' : 'Активных пользователей'}
              value={isCreator ? reportPayload.team.total_users : reportPayload.team.active_users}
              tone="brand"
              note={isCreator ? `Админов: ${reportPayload.team.admins}` : `Неактивных: ${reportPayload.team.inactive_users}`}
            />
            <StatCard
              label="Ближайшее служение"
              value={reportPayload.service.upcoming_assigned}
              note={`Назначено позиций, свободно: ${reportPayload.service.upcoming_unassigned}`}
            />
            <StatCard
              label={isCreator ? 'Push-подписок' : 'Прогресс чек-листов'}
              value={isCreator ? reportPayload.team.push_subscriptions : `${reportPayload.instructions.current_week_completion_rate}%`}
              tone="accent"
              note={isCreator ? 'Подключённых устройств' : `Заполнено записей: ${reportPayload.instructions.current_week_progress_records}`}
            />
          </div>
        </div>

        <aside className="surface-card-dark rounded-[30px] p-5 text-white lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Быстрые действия</p>
          <div className="mt-5 grid gap-3">
            {isCreator ? (
              <>
                <QuickLink href="/dashboard/users" title="Участники и роли" body="Создание пользователей, админов и управление доступом." tone="dark" />
                <QuickLink href="/dashboard/reports" title="Открыть полную аналитику" body="Детальные отчёты по системе и команде." tone="dark" />
                <QuickLink href="/dashboard/settings" title="Настройки PWA и push" body="Установка приложения и управление устройствами." tone="dark" />
              </>
            ) : (
              <>
                <QuickLink href="/dashboard/schedule" title="Открыть ротацию" body="Распределить людей по позициям ближайшего служения." tone="dark" />
                <QuickLink href="/dashboard/broadcasts" title="Рассылки" body="Отправить сообщение команде или сбор на подарок." tone="dark" />
                <QuickLink href="/dashboard/duty" title="Дежурства" body="Проверить очередь коморки и ручной сдвиг." tone="dark" />
              </>
            )}
          </div>
        </aside>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Week ID" value={reportPayload.service.upcoming_week_id} />
        <StatCard label="Дата служения" value={formatDate(reportPayload.service.upcoming_service_date)} />
        <StatCard label="Рассылки" value={reportPayload.communication.broadcast_campaigns} />
        <StatCard label="Непрочитано сообщений" value={reportPayload.communication.unread_inbox_messages + reportPayload.communication.unread_direct_messages} tone="brand" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="surface-card rounded-[30px] p-5 lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">
            {isCreator ? 'Системная картина' : 'Ближайшие назначения'}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-ink">
            {isCreator ? 'Ключевые показатели' : 'Список позиций на ближайшее служение'}
          </h3>
          <div className="mt-6 grid gap-3">
            {(isCreator ? reportPayload.top_service_users : reportPayload.upcoming_assignments).map((item, index) =>
              isCreator ? (
                <div key={`load-${(item as ReportOverviewResponse['top_service_users'][number]).user_id}`} className="metric-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {index + 1}. {(item as ReportOverviewResponse['top_service_users'][number]).display_name}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">
                        {roleLabel((item as ReportOverviewResponse['top_service_users'][number]).role as UserRecord['role'])}
                      </p>
                    </div>
                    <div className="rounded-full bg-brandSoft px-3 py-1 text-xs font-semibold text-brand">
                      {(item as ReportOverviewResponse['top_service_users'][number]).total_load}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted">
                    Основных: {(item as ReportOverviewResponse['top_service_users'][number]).assignments_main} · Напарник: {(item as ReportOverviewResponse['top_service_users'][number]).assignments_partner} · Фиксаций: {(item as ReportOverviewResponse['top_service_users'][number]).hold_positions}
                  </p>
                </div>
              ) : (
                <div key={`assignment-${(item as ReportOverviewResponse['upcoming_assignments'][number]).position_name}`} className="metric-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{(item as ReportOverviewResponse['upcoming_assignments'][number]).position_name}</p>
                      <p className="mt-1 text-sm text-muted">
                        {(item as ReportOverviewResponse['upcoming_assignments'][number]).user_name || 'Не назначено'}
                        {(item as ReportOverviewResponse['upcoming_assignments'][number]).partner_user_name
                          ? ` · напарник: ${(item as ReportOverviewResponse['upcoming_assignments'][number]).partner_user_name}`
                          : ''}
                      </p>
                    </div>
                    <div className="rounded-full bg-brandSoft px-3 py-1 text-xs font-semibold text-brand">
                      {(item as ReportOverviewResponse['upcoming_assignments'][number]).hold_remaining
                        ? `Фиксация: ${(item as ReportOverviewResponse['upcoming_assignments'][number]).hold_remaining}`
                        : 'Ротация'}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-card rounded-[30px] p-5 lg:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">
              {isCreator ? 'Команда' : 'Коморка'}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-ink">
              {isCreator ? 'Ближайшие дни рождения' : 'Дежурства и очередь'}
            </h3>
            {isCreator ? (
              <div className="mt-6 grid gap-3">
                {reportPayload.upcoming_birthdays.map((item) => (
                  <div key={item.user_id} className="metric-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{item.display_name}</p>
                        <p className="mt-1 text-sm text-muted">{formatDate(item.next_birthday)}</p>
                      </div>
                      <div className="rounded-full bg-brandSoft px-3 py-1 text-xs font-semibold text-brand">{item.days_until} дн.</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <StatCard label="В очереди" value={reportPayload.duty.queue_size} />
                <StatCard label="Сдвигов" value={reportPayload.duty.advances_total} />
                <StatCard label="Текущий" value={reportPayload.duty.current_user_name || '—'} />
                <StatCard label="Следующий" value={reportPayload.duty.next_user_name || '—'} tone="brand" />
              </div>
            )}
          </div>

          <div className="surface-card rounded-[30px] p-5 lg:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">
              {isCreator ? 'Коммуникации' : 'Сообщения и чек-листы'}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-ink">
              {isCreator ? 'Статус системы' : 'Операционные показатели'}
            </h3>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <StatCard label="Inbox" value={reportPayload.communication.inbox_messages} />
              <StatCard label="Личные" value={reportPayload.communication.direct_messages} />
              <StatCard label="Непрочитано" value={reportPayload.communication.unread_inbox_messages + reportPayload.communication.unread_direct_messages} tone="accent" />
              <StatCard label="Чек-листы" value={`${reportPayload.instructions.current_week_completion_rate}%`} tone="brand" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
