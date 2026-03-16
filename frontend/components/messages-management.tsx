'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiFetch, AuthResponse, MessageCollectionResponse, MessageItemRecord, UserRecord } from '@/lib/api';

function formatUserName(user: UserRecord | null | undefined) {
  if (!user) return 'Система';
  return user.full_name || user.login;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function messageBadge(item: MessageItemRecord) {
  if (item.kind === 'broadcast') return 'Рассылка';
  if (item.direction === 'outgoing') return 'Отправлено';
  return 'Личное сообщение';
}

function composeFieldClass() {
  return 'w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/55';
}

export function MessagesManagement() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [payload, setPayload] = useState<MessageCollectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, messages] = await Promise.all([
        apiFetch<AuthResponse>('/auth/me'),
        apiFetch<MessageCollectionResponse>('/messages')
      ]);
      setCurrentUser(me.user);
      setPayload(messages);
      if (!recipientId && messages.contacts[0]) {
        setRecipientId(String(messages.contacts[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить сообщения');
    } finally {
      setLoading(false);
    }
  }, [recipientId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 2500);
    return () => window.clearTimeout(timer);
  }, [success]);

  const unreadDirectCount = useMemo(
    () => (payload?.items || []).filter((item) => item.kind === 'direct' && item.direction === 'incoming' && !item.is_read).length,
    [payload?.items]
  );
  const unreadBroadcastCount = useMemo(
    () => (payload?.items || []).filter((item) => item.kind === 'broadcast' && !item.is_read).length,
    [payload?.items]
  );

  async function sendMessage() {
    if (!recipientId) return;
    setBusyKey('send');
    setError(null);
    try {
      await apiFetch<MessageCollectionResponse>('/messages/send', {
        method: 'POST',
        body: JSON.stringify({ recipient_user_id: Number(recipientId), title, body })
      });
      setSuccess('Сообщение отправлено');
      setTitle('');
      setBody('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
    } finally {
      setBusyKey(null);
    }
  }

  async function markRead(item: MessageItemRecord) {
    const key = `${item.kind}:${item.record_id}`;
    setBusyKey(key);
    setError(null);
    try {
      const path = item.kind === 'broadcast' ? `/messages/broadcast/${item.record_id}/read` : `/messages/direct/${item.record_id}/read`;
      await apiFetch<MessageCollectionResponse>(path, { method: 'PATCH' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить сообщение');
    } finally {
      setBusyKey(null);
    }
  }

  function prepareReply(item: MessageItemRecord) {
    const target = item.direction === 'incoming' ? item.sender_user : item.recipient_user;
    if (!target) return;
    setRecipientId(String(target.id));
    setTitle(item.kind === 'direct' ? `Re: ${item.title}` : item.title);
    setBody(`\n\n---\n${item.body}`);
  }

  if (loading || !payload) {
    return (
      <section className="surface-card rounded-[30px] p-5 lg:p-6">
        <p className="text-sm text-muted">Загрузка сообщений...</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="surface-card rounded-[30px] p-5 lg:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <span className="dashboard-chip">Сообщения</span>
              <h2 className="mt-3 text-2xl font-semibold text-ink">Inbox и переписка</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                Здесь объединены системные рассылки и личные сообщения. Пользователь пишет админу, админ отвечает прямо из этого же раздела.
              </p>
            </div>
            <div className="rounded-2xl border border-line/70 bg-white/80 px-4 py-3 text-sm font-semibold text-ink">
              Непрочитано: {payload.unread_count}
            </div>
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-accent">{error}</div> : null}
          {success ? <div className="mt-4 rounded-2xl border border-brand/20 bg-brandSoft px-4 py-3 text-sm text-brand">{success}</div> : null}

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="metric-card">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Всего сообщений</p>
              <p className="mt-3 text-2xl font-semibold text-ink">{payload.items.length}</p>
            </div>
            <div className="metric-card">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Личные непрочитанные</p>
              <p className="mt-3 text-2xl font-semibold text-brand">{unreadDirectCount}</p>
            </div>
            <div className="metric-card">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Рассылки непрочитанные</p>
              <p className="mt-3 text-2xl font-semibold text-accent">{unreadBroadcastCount}</p>
            </div>
          </div>
        </div>

        <aside className="surface-card-dark rounded-[30px] p-5 text-white lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Новое сообщение</p>
          <div className="mt-4 grid gap-3">
            <select
              value={recipientId}
              onChange={(event) => setRecipientId(event.target.value)}
              disabled={busyKey !== null}
              className={composeFieldClass()}
            >
              {payload.contacts.map((contact) => (
                <option key={contact.id} value={contact.id} className="text-ink">
                  {contact.display_name} · {contact.role}
                </option>
              ))}
            </select>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Заголовок"
              disabled={busyKey !== null}
              className={composeFieldClass()}
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={8}
              placeholder="Текст сообщения"
              disabled={busyKey !== null}
              className={composeFieldClass()}
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={busyKey !== null}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#18304f] transition hover:bg-[#edf2f7] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Отправить
            </button>
          </div>
        </aside>
      </section>

      <section className="surface-card rounded-[30px] p-5 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="dashboard-chip">Лента</span>
            <h3 className="mt-3 text-xl font-semibold text-ink">Последние сообщения</h3>
          </div>
          <div className="rounded-2xl border border-line/70 bg-white/80 px-4 py-3 text-sm font-semibold text-muted">
            Контактов: {payload.contacts.length}
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {payload.items.length === 0 ? (
            <div className="surface-card-strong rounded-[24px] border border-dashed border-line/70 p-4 text-sm text-muted">
              Сообщений пока нет.
            </div>
          ) : (
            payload.items.map((item) => {
              const targetUser = item.direction === 'incoming' ? item.sender_user : item.recipient_user;
              const canReply = item.kind === 'direct' && targetUser && targetUser.id !== currentUser?.id;
              return (
                <div
                  key={`${item.kind}-${item.record_id}`}
                  className={`rounded-[24px] p-4 lg:p-5 ${
                    item.is_read ? 'surface-card-strong' : 'surface-card-strong ring-1 ring-brand/20'
                  }`}
                >
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold text-ink">{item.title}</h4>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            item.kind === 'broadcast' ? 'bg-brandSoft text-brand' : 'bg-[#18304f] text-white'
                          }`}
                        >
                          {messageBadge(item)}
                        </span>
                        {!item.is_read ? (
                          <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                            Новое
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted">
                        {formatDate(item.created_at)}
                        {targetUser ? ` · ${item.direction === 'incoming' ? 'От' : 'Кому'}: ${formatUserName(targetUser)}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {!item.is_read && item.direction !== 'outgoing' ? (
                        <button
                          type="button"
                          onClick={() => void markRead(item)}
                          disabled={busyKey !== null}
                          className="rounded-2xl border border-brand/20 bg-brandSoft px-4 py-2.5 text-sm font-semibold text-brand transition hover:border-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Прочитано
                        </button>
                      ) : null}
                      {canReply ? (
                        <button
                          type="button"
                          onClick={() => prepareReply(item)}
                          className="rounded-2xl border border-line/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
                        >
                          Ответить
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <pre className="mt-4 whitespace-pre-wrap rounded-[22px] border border-line/60 bg-white/72 p-4 font-sans text-sm leading-7 text-ink">
                    {item.body}
                  </pre>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
