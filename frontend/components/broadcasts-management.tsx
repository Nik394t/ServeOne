'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  apiFetch,
  AuthResponse,
  BirthdayBroadcastPersonRecord,
  BroadcastCollectionResponse,
  UserRecord
} from '@/lib/api';

type BroadcastKind = 'general' | 'birthday_gift';
type TargetMode = 'all' | 'users' | 'admins' | 'selected';

function formatUserName(user: UserRecord) {
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

function formatBirthdayDate(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value));
}

function buildBirthdayGiftPreview(params: {
  person: BirthdayBroadcastPersonRecord | null;
  addressForm: 'brother' | 'sister' | '';
  cardNumber: string;
  sbpPhone: string;
  bankName: string;
  recipientName: string;
  extraNote: string;
}) {
  const { person, addressForm, cardNumber, sbpPhone, bankName, recipientName, extraNote } = params;
  if (!person) {
    return 'Выберите именинника, чтобы увидеть предпросмотр сбора на подарок.';
  }
  const relation = (addressForm || person.address_form) === 'sister' ? 'нашу сестру' : 'нашего брата';
  const genitiveName = person.genitive_name || person.display_name;
  const lines = [`💛 Друзья, совсем скоро в нашей медиа-команде день рождения у ${genitiveName}.`];
  if (person.birth_date) {
    const short = new Date(person.birth_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    lines.push(`Дата: ${formatBirthdayDate(person.birth_date)} (${short}).`);
  }
  lines.push('');
  lines.push(`Давайте почтим ${relation} и соберём на подарок: можно принести сумму в конверт или перевести заранее.`);

  const paymentLines: string[] = [];
  if (cardNumber.trim()) {
    paymentLines.push(`• Карта: ${cardNumber.trim()}`);
  }
  if (sbpPhone.trim()) {
    const suffixParts = [bankName.trim(), recipientName.trim()].filter(Boolean);
    const suffix = suffixParts.length ? ` (${suffixParts.join(', ')})` : '';
    paymentLines.push(`• СБП: ${sbpPhone.trim()}${suffix}`);
  }
  if (paymentLines.length) {
    lines.push('');
    lines.push('Если есть на сердце поучаствовать:');
    lines.push(...paymentLines);
  }

  lines.push('');
  lines.push('Пожалуйста, подпишите перевод: «подарок». Спасибо за единство и любовь в команде.');
  if (extraNote.trim()) {
    lines.push('');
    lines.push(extraNote.trim());
  }
  return lines.join('\n');
}

export function BroadcastsManagement() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [payload, setPayload] = useState<BroadcastCollectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [kind, setKind] = useState<BroadcastKind>('general');
  const [targetMode, setTargetMode] = useState<TargetMode>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [excludedIds, setExcludedIds] = useState<number[]>([]);
  const [birthdayUserId, setBirthdayUserId] = useState('');
  const [addressForm, setAddressForm] = useState<'brother' | 'sister' | ''>('');
  const [cardNumber, setCardNumber] = useState('');
  const [sbpPhone, setSbpPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [extraNote, setExtraNote] = useState('');

  const canManage = currentUser?.role === 'creator' || currentUser?.role === 'admin';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, broadcasts] = await Promise.all([
        apiFetch<AuthResponse>('/auth/me'),
        apiFetch<BroadcastCollectionResponse>('/broadcasts')
      ]);
      setCurrentUser(me.user);
      setPayload(broadcasts);
      if (!birthdayUserId && broadcasts.birthday_people[0]) {
        setBirthdayUserId(String(broadcasts.birthday_people[0].user_id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить раздел рассылок');
    } finally {
      setLoading(false);
    }
  }, [birthdayUserId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 2500);
    return () => window.clearTimeout(timer);
  }, [success]);

  const activeUsers = useMemo(() => payload?.users || [], [payload?.users]);
  const birthdayPeople = useMemo(() => payload?.birthday_people || [], [payload?.birthday_people]);
  const selectedBirthdayPerson = useMemo(
    () => birthdayPeople.find((person) => String(person.user_id) === birthdayUserId) || null,
    [birthdayPeople, birthdayUserId]
  );

  const baseRecipients = useMemo(() => {
    if (!payload) return [] as UserRecord[];
    if (targetMode === 'all') return activeUsers;
    if (targetMode === 'users') return activeUsers.filter((user) => user.role === 'user');
    if (targetMode === 'admins') return activeUsers.filter((user) => user.role === 'admin' || user.role === 'creator');
    return activeUsers.filter((user) => selectedIds.includes(user.id));
  }, [activeUsers, payload, selectedIds, targetMode]);

  const finalRecipients = useMemo(() => {
    const autoExcluded = new Set(excludedIds);
    if (kind === 'birthday_gift' && birthdayUserId) {
      autoExcluded.add(Number(birthdayUserId));
    }
    return baseRecipients.filter((user) => !autoExcluded.has(user.id));
  }, [baseRecipients, birthdayUserId, excludedIds, kind]);

  const previewText = useMemo(() => {
    if (kind === 'general') {
      return body.trim() || 'Введи текст, чтобы увидеть предпросмотр общей рассылки.';
    }
    return buildBirthdayGiftPreview({
      person: selectedBirthdayPerson,
      addressForm,
      cardNumber,
      sbpPhone,
      bankName,
      recipientName,
      extraNote
    });
  }, [addressForm, bankName, body, cardNumber, extraNote, kind, recipientName, sbpPhone, selectedBirthdayPerson]);

  async function sendBroadcast() {
    if (!canManage) return;
    setBusyKey('send');
    setError(null);
    try {
      const payloadBody = {
        kind,
        title: kind === 'general' ? title : null,
        body: kind === 'general' ? body : null,
        target_mode: targetMode,
        selected_user_ids: selectedIds,
        excluded_user_ids: excludedIds,
        birthday_user_id: kind === 'birthday_gift' && birthdayUserId ? Number(birthdayUserId) : null,
        address_form: kind === 'birthday_gift' ? addressForm || null : null,
        card_number: kind === 'birthday_gift' ? cardNumber || null : null,
        sbp_phone: kind === 'birthday_gift' ? sbpPhone || null : null,
        bank_name: kind === 'birthday_gift' ? bankName || null : null,
        recipient_name: kind === 'birthday_gift' ? recipientName || null : null,
        extra_note: kind === 'birthday_gift' ? extraNote || null : null
      };
      const response = await apiFetch<{ status: string; campaign_id: number; recipient_count: number }>('/broadcasts/send', {
        method: 'POST',
        body: JSON.stringify(payloadBody)
      });
      setSuccess(`Рассылка отправлена. Получателей: ${response.recipient_count}`);
      setTitle('');
      setBody('');
      setSelectedIds([]);
      setExcludedIds([]);
      setExtraNote('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить рассылку');
    } finally {
      setBusyKey(null);
    }
  }

  function toggleSelected(userId: number) {
    setSelectedIds((state) => (state.includes(userId) ? state.filter((id) => id !== userId) : [...state, userId]));
  }

  function toggleExcluded(userId: number) {
    setExcludedIds((state) => (state.includes(userId) ? state.filter((id) => id !== userId) : [...state, userId]));
  }

  if (loading || !payload) {
    return (
      <section className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
        <p className="text-sm text-muted">Загрузка рассылок...</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Рассылки</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Сценарии отправок</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                Модуль собирает общие объявления, сценарий сбора на подарок и историю фактических отправок по пользователям приложения.
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink">
              История: {payload.history.length}
            </div>
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-accent">{error}</div> : null}
          {success ? <div className="mt-4 rounded-2xl border border-brand/20 bg-brandSoft px-4 py-3 text-sm text-brand">{success}</div> : null}

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Активных пользователей</p>
              <p className="mt-2 text-lg font-semibold text-ink">{activeUsers.length}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Получателей сейчас</p>
              <p className="mt-2 text-lg font-semibold text-ink">{finalRecipients.length}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Сценарий</p>
              <p className="mt-2 text-lg font-semibold text-ink">{kind === 'general' ? 'Общая рассылка' : 'Сбор на подарок'}</p>
            </div>
          </div>
        </div>

        <aside className="rounded-[28px] border border-line/70 bg-[#18304f] p-5 text-white shadow-panel lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Предпросмотр</p>
          <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/12 bg-white/8 p-4 font-sans text-sm leading-7 text-white/82">
            {previewText}
          </pre>
        </aside>
      </section>

      <section className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Сценарий</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setKind('general')}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${kind === 'general' ? 'bg-brand text-white' : 'border border-line bg-panel text-ink'}`}
                >
                  Общая рассылка
                </button>
                <button
                  type="button"
                  onClick={() => setKind('birthday_gift')}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${kind === 'birthday_gift' ? 'bg-brand text-white' : 'border border-line bg-panel text-ink'}`}
                >
                  Сбор на подарок
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Получатели</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm text-muted">Режим</span>
                  <select
                    value={targetMode}
                    onChange={(event) => setTargetMode(event.target.value as TargetMode)}
                    disabled={!canManage || busyKey !== null}
                    className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="all">Все активные</option>
                    <option value="users">Только пользователи</option>
                    <option value="admins">Только админы</option>
                    <option value="selected">Выбрать вручную</option>
                  </select>
                </label>
                <div className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink">
                  Финально получат: <span className="font-semibold">{finalRecipients.length}</span>
                </div>
              </div>

              <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {activeUsers.map((user) => {
                  const inBase = baseRecipients.some((candidate) => candidate.id === user.id);
                  const isSelectedMode = targetMode === 'selected';
                  const isChecked = isSelectedMode ? selectedIds.includes(user.id) : inBase;
                  const isExcluded = excludedIds.includes(user.id) || (kind === 'birthday_gift' && String(user.id) === birthdayUserId);
                  return (
                    <div key={user.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{formatUserName(user)}</p>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted">{user.role}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {isSelectedMode ? (
                          <label className="flex items-center gap-2 text-sm text-muted">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelected(user.id)}
                              disabled={!canManage || busyKey !== null}
                              className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
                            />
                            Выбрать
                          </label>
                        ) : (
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${inBase ? 'bg-brandSoft text-brand' : 'bg-line text-muted'}`}>
                            {inBase ? 'В выборке' : 'Вне выборки'}
                          </span>
                        )}
                        <label className="flex items-center gap-2 text-sm text-muted">
                          <input
                            type="checkbox"
                            checked={isExcluded}
                            onChange={() => toggleExcluded(user.id)}
                            disabled={!canManage || busyKey !== null || (kind === 'birthday_gift' && String(user.id) === birthdayUserId)}
                            className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                          />
                          Не отправлять
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {kind === 'general' ? (
              <div className="rounded-2xl border border-line bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Общая рассылка</p>
                <div className="mt-4 grid gap-3">
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Заголовок"
                    disabled={!canManage || busyKey !== null}
                    className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    rows={10}
                    placeholder="Текст рассылки"
                    disabled={!canManage || busyKey !== null}
                    className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-line bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Сбор на подарок</p>
                <div className="mt-4 grid gap-3">
                  <select
                    value={birthdayUserId}
                    onChange={(event) => setBirthdayUserId(event.target.value)}
                    disabled={!canManage || busyKey !== null}
                    className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {birthdayPeople.map((person) => (
                      <option key={person.user_id} value={person.user_id}>
                        {person.display_name}
                      </option>
                    ))}
                  </select>
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      value={addressForm}
                      onChange={(event) => setAddressForm(event.target.value as 'brother' | 'sister' | '')}
                      disabled={!canManage || busyKey !== null}
                      className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">Форма из карточки</option>
                      <option value="brother">Брат</option>
                      <option value="sister">Сестра</option>
                    </select>
                    <input
                      value={cardNumber}
                      onChange={(event) => setCardNumber(event.target.value)}
                      placeholder="Карта"
                      disabled={!canManage || busyKey !== null}
                      className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      value={sbpPhone}
                      onChange={(event) => setSbpPhone(event.target.value)}
                      placeholder="СБП"
                      disabled={!canManage || busyKey !== null}
                      className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <input
                      value={bankName}
                      onChange={(event) => setBankName(event.target.value)}
                      placeholder="Банк"
                      disabled={!canManage || busyKey !== null}
                      className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <input
                      value={recipientName}
                      onChange={(event) => setRecipientName(event.target.value)}
                      placeholder="Получатель"
                      disabled={!canManage || busyKey !== null}
                      className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                  <textarea
                    value={extraNote}
                    onChange={(event) => setExtraNote(event.target.value)}
                    rows={4}
                    placeholder="Дополнительная заметка"
                    disabled={!canManage || busyKey !== null}
                    className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>
            )}

            {canManage ? (
              <div className="rounded-2xl border border-line bg-white p-4">
                <button
                  type="button"
                  onClick={() => void sendBroadcast()}
                  disabled={busyKey !== null}
                  className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1f4f92] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Отправить рассылку
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">История</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">Последние отправки</h3>
          </div>
          <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-muted">
            {payload.history.length} записей
          </div>
        </div>

        <div className="mt-6 grid gap-4 2xl:grid-cols-2">
          {payload.history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-white p-4 text-sm text-muted">
              История рассылок пока пуста.
            </div>
          ) : (
            payload.history.map((item) => (
              <div key={item.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold text-ink">{item.title}</h4>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.kind === 'birthday_gift' ? 'bg-brandSoft text-brand' : 'bg-[#18304f] text-white'}`}>
                        {item.kind === 'birthday_gift' ? 'Сбор на подарок' : 'Общая'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
                      {formatDate(item.created_at)} · {item.created_by_user_name || 'Система'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm font-semibold text-ink">
                    Получателей: {item.recipient_count}
                  </div>
                </div>
                <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-line bg-panel p-4 font-sans text-sm leading-7 text-ink">{item.body}</pre>
                <div className="mt-4 rounded-2xl border border-line bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Кому ушло</p>
                  <p className="mt-2 text-sm leading-7 text-muted">{item.recipients.join(', ') || 'Нет получателей'}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
