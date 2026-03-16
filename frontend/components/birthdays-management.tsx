'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  apiFetch,
  AuthResponse,
  BirthdayCollectionResponse,
  BirthdayPersonRecord,
  BirthdayTemplateRecord,
  UserRecord
} from '@/lib/api';

type PersonDraft = {
  birth_date: string;
  genitive_name: string;
  address_form: 'brother' | 'sister' | '';
  note: string;
};

type TemplateDraft = {
  title: string;
  message: string;
  scripture: string;
  sort_order: string;
  is_active: boolean;
};

const EMPTY_TEMPLATE: TemplateDraft = {
  title: '',
  message: '',
  scripture: '',
  sort_order: '100',
  is_active: true
};

function formatUserName(user: UserRecord) {
  return user.full_name || user.login;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value));
}

function personDraftFromRecord(person: BirthdayPersonRecord): PersonDraft {
  return {
    birth_date: person.birth_date || '',
    genitive_name: person.genitive_name || '',
    address_form: person.address_form || '',
    note: person.note || ''
  };
}

function templateDraftFromRecord(template: BirthdayTemplateRecord): TemplateDraft {
  return {
    title: template.title,
    message: template.message,
    scripture: template.scripture || '',
    sort_order: String(template.sort_order),
    is_active: template.is_active
  };
}

function renderBirthdayTemplate(template: BirthdayTemplateRecord | null, person: BirthdayPersonRecord | null) {
  if (!template || !person) return 'Выберите человека и шаблон, чтобы увидеть готовый текст поздравления.';
  const name = person.genitive_name || formatUserName(person.user);
  const text = template.message.replaceAll('{name}', name);
  return template.scripture ? `${text}\n\n${template.scripture}` : text;
}

export function BirthdaysManagement() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [payload, setPayload] = useState<BirthdayCollectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [personDrafts, setPersonDrafts] = useState<Record<number, PersonDraft>>({});
  const [templateDrafts, setTemplateDrafts] = useState<Record<number, TemplateDraft>>({});
  const [newTemplateDraft, setNewTemplateDraft] = useState<TemplateDraft>(EMPTY_TEMPLATE);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [previewUserId, setPreviewUserId] = useState<string>('');
  const [previewTemplateId, setPreviewTemplateId] = useState<string>('');

  const canManage = currentUser?.role === 'creator' || currentUser?.role === 'admin';

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [me, birthdays] = await Promise.all([
        apiFetch<AuthResponse>('/auth/me'),
        apiFetch<BirthdayCollectionResponse>('/birthdays')
      ]);
      setCurrentUser(me.user);
      setPayload(birthdays);

      const nextPersonDrafts: Record<number, PersonDraft> = {};
      for (const person of birthdays.people) {
        nextPersonDrafts[person.user.id] = personDraftFromRecord(person);
      }
      setPersonDrafts(nextPersonDrafts);

      const nextTemplateDrafts: Record<number, TemplateDraft> = {};
      for (const template of birthdays.templates) {
        nextTemplateDrafts[template.id] = templateDraftFromRecord(template);
      }
      setTemplateDrafts(nextTemplateDrafts);

      const firstPerson = birthdays.people.find((person) => person.birth_date) || birthdays.people[0];
      const firstTemplate = birthdays.templates.find((template) => template.is_active) || birthdays.templates[0];
      setPreviewUserId(firstPerson ? String(firstPerson.user.id) : '');
      setPreviewTemplateId(firstTemplate ? String(firstTemplate.id) : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить дни рождения');
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

  const configuredCount = useMemo(() => (payload?.people || []).filter((person) => person.birth_date).length, [payload?.people]);
  const upcomingCount = useMemo(
    () => (payload?.people || []).filter((person) => person.days_until !== null && person.days_until <= 30).length,
    [payload?.people]
  );
  const activeTemplateCount = useMemo(
    () => (payload?.templates || []).filter((template) => template.is_active).length,
    [payload?.templates]
  );

  const previewPerson = useMemo(
    () => (payload?.people || []).find((person) => String(person.user.id) === previewUserId) || null,
    [payload?.people, previewUserId]
  );
  const previewTemplate = useMemo(
    () => (payload?.templates || []).find((template) => String(template.id) === previewTemplateId) || null,
    [payload?.templates, previewTemplateId]
  );

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

  function updatePersonDraft(userId: number, patch: Partial<PersonDraft>) {
    setPersonDrafts((state) => ({
      ...state,
      [userId]: {
        ...(state[userId] || { birth_date: '', genitive_name: '', address_form: '', note: '' }),
        ...patch
      }
    }));
  }

  function updateTemplateDraft(templateId: number, patch: Partial<TemplateDraft>) {
    setTemplateDrafts((state) => ({
      ...state,
      [templateId]: {
        ...(state[templateId] || EMPTY_TEMPLATE),
        ...patch
      }
    }));
  }

  async function savePerson(userId: number) {
    const draft = personDrafts[userId];
    await runAction(
      `person:${userId}`,
      () =>
        apiFetch<BirthdayCollectionResponse>(`/birthdays/people/${userId}`, {
          method: 'PUT',
          body: JSON.stringify({
            birth_date: draft.birth_date || null,
            genitive_name: draft.genitive_name || null,
            address_form: draft.address_form || null,
            note: draft.note || null
          })
        }).then(() => undefined),
      'Карточка дня рождения сохранена'
    );
  }

  async function clearPerson(userId: number) {
    updatePersonDraft(userId, { birth_date: '', genitive_name: '', address_form: '', note: '' });
    await runAction(
      `person:clear:${userId}`,
      () =>
        apiFetch<BirthdayCollectionResponse>(`/birthdays/people/${userId}`, {
          method: 'PUT',
          body: JSON.stringify({
            birth_date: null,
            genitive_name: null,
            address_form: null,
            note: null
          })
        }).then(() => undefined),
      'Карточка дня рождения очищена'
    );
  }

  async function saveTemplate(templateId: number) {
    const draft = templateDrafts[templateId];
    await runAction(
      `template:${templateId}`,
      () =>
        apiFetch<BirthdayCollectionResponse>(`/birthdays/templates/${templateId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: draft.title,
            message: draft.message,
            scripture: draft.scripture || null,
            sort_order: Number(draft.sort_order || '0'),
            is_active: draft.is_active
          })
        }).then(() => undefined),
      'Шаблон обновлён'
    );
    setEditingTemplateId(null);
  }

  async function createTemplate() {
    await runAction(
      'template:create',
      () =>
        apiFetch<BirthdayCollectionResponse>('/birthdays/templates', {
          method: 'POST',
          body: JSON.stringify({
            title: newTemplateDraft.title,
            message: newTemplateDraft.message,
            scripture: newTemplateDraft.scripture || null,
            sort_order: Number(newTemplateDraft.sort_order || '0'),
            is_active: newTemplateDraft.is_active
          })
        }).then(() => undefined),
      'Шаблон добавлен'
    );
    setNewTemplateDraft(EMPTY_TEMPLATE);
  }

  async function deleteTemplate(templateId: number, title: string) {
    if (!window.confirm(`Удалить шаблон «${title}»?`)) return;
    await runAction(
      `template:delete:${templateId}`,
      () => apiFetch<BirthdayCollectionResponse>(`/birthdays/templates/${templateId}`, { method: 'DELETE' }).then(() => undefined),
      'Шаблон удалён'
    );
  }

  if (loading || !payload) {
    return (
      <section className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
        <p className="text-sm text-muted">Загрузка дней рождения...</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Дни рождения</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Календарь команды</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                Здесь хранятся даты, формы обращения и шаблоны поздравлений. Данные пригодятся и для личных поздравлений, и для будущих рассылок по команде.
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink">
              Сегодня: {formatDate(payload.today)}
            </div>
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-accent">{error}</div> : null}
          {success ? <div className="mt-4 rounded-2xl border border-brand/20 bg-brandSoft px-4 py-3 text-sm text-brand">{success}</div> : null}

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Заполнено дат</p>
              <p className="mt-2 text-lg font-semibold text-ink">{configuredCount}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Ближайшие 30 дней</p>
              <p className="mt-2 text-lg font-semibold text-ink">{upcomingCount}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Активных шаблонов</p>
              <p className="mt-2 text-lg font-semibold text-ink">{activeTemplateCount}</p>
            </div>
          </div>
        </div>

        <aside className="rounded-[28px] border border-line/70 bg-[#18304f] p-5 text-white shadow-panel lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Предпросмотр поздравления</p>
          <div className="mt-4 space-y-3">
            <select
              value={previewUserId}
              onChange={(event) => setPreviewUserId(event.target.value)}
              className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none"
            >
              {(payload.people || []).map((person) => (
                <option key={person.user.id} value={person.user.id} className="text-ink">
                  {formatUserName(person.user)}
                </option>
              ))}
            </select>
            <select
              value={previewTemplateId}
              onChange={(event) => setPreviewTemplateId(event.target.value)}
              className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none"
            >
              {(payload.templates || []).map((template) => (
                <option key={template.id} value={template.id} className="text-ink">
                  {template.title}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 rounded-2xl border border-white/12 bg-white/8 p-4">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-white/82">{renderBirthdayTemplate(previewTemplate, previewPerson)}</pre>
          </div>
        </aside>
      </section>

      <section className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Люди</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">Карточки дней рождения</h3>
          </div>
          <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-muted">
            {(payload.people || []).length} участников
          </div>
        </div>

        <div className="mt-6 grid gap-4 2xl:grid-cols-2">
          {payload.people.map((person) => {
            const draft = personDrafts[person.user.id] || personDraftFromRecord(person);
            return (
              <div key={person.user.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-ink">{formatUserName(person.user)}</h4>
                    <p className="mt-1 text-sm text-muted">
                      {person.birth_date ? `Следующий день рождения: ${formatDate(person.next_birthday as string)}` : 'Дата пока не указана'}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">
                      {person.days_until === null ? 'Без даты' : `Осталось дней: ${person.days_until}`}
                    </p>
                  </div>
                  {person.address_form ? (
                    <div className="rounded-full bg-brandSoft px-3 py-1 text-xs font-semibold text-brand">
                      {person.address_form === 'brother' ? 'Брат' : 'Сестра'}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm text-muted">Дата рождения</span>
                    <input
                      type="date"
                      value={draft.birth_date}
                      onChange={(event) => updatePersonDraft(person.user.id, { birth_date: event.target.value })}
                      disabled={!canManage || busyKey !== null}
                      className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-muted">Форма обращения</span>
                    <select
                      value={draft.address_form}
                      onChange={(event) => updatePersonDraft(person.user.id, { address_form: event.target.value as PersonDraft['address_form'] })}
                      disabled={!canManage || busyKey !== null}
                      className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">Не выбрано</option>
                      <option value="brother">Брат</option>
                      <option value="sister">Сестра</option>
                    </select>
                  </label>
                </div>

                <div className="mt-3 grid gap-3">
                  <label className="space-y-2">
                    <span className="text-sm text-muted">Имя в склонении</span>
                    <input
                      value={draft.genitive_name}
                      onChange={(event) => updatePersonDraft(person.user.id, { genitive_name: event.target.value })}
                      disabled={!canManage || busyKey !== null}
                      placeholder="Например: Арсения"
                      className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-muted">Заметка</span>
                    <textarea
                      value={draft.note}
                      onChange={(event) => updatePersonDraft(person.user.id, { note: event.target.value })}
                      disabled={!canManage || busyKey !== null}
                      rows={3}
                      className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                </div>

                {canManage ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void savePerson(person.user.id)}
                      disabled={busyKey !== null}
                      className="rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1f4f92] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Сохранить
                    </button>
                    {person.birth_date ? (
                      <button
                        type="button"
                        onClick={() => void clearPerson(person.user.id)}
                        disabled={busyKey !== null}
                        className="rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition hover:border-accent/45 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Очистить
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Шаблоны</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">Библиотека поздравлений</h3>
          </div>
          <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-muted">
            {(payload.templates || []).length} шаблонов
          </div>
        </div>

        {canManage ? (
          <div className="mt-6 rounded-2xl border border-line bg-white p-4">
            <p className="text-sm font-semibold text-ink">Новый шаблон</p>
            <div className="mt-4 grid gap-3">
              <input
                value={newTemplateDraft.title}
                onChange={(event) => setNewTemplateDraft((state) => ({ ...state, title: event.target.value }))}
                placeholder="Название"
                disabled={busyKey !== null}
                className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              />
              <textarea
                value={newTemplateDraft.message}
                onChange={(event) => setNewTemplateDraft((state) => ({ ...state, message: event.target.value }))}
                placeholder="Текст поздравления. Используй {name} для подстановки имени."
                rows={5}
                disabled={busyKey !== null}
                className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              />
              <div className="grid gap-3 md:grid-cols-[1fr_180px_160px]">
                <input
                  value={newTemplateDraft.scripture}
                  onChange={(event) => setNewTemplateDraft((state) => ({ ...state, scripture: event.target.value }))}
                  placeholder="Место Писания"
                  disabled={busyKey !== null}
                  className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                />
                <input
                  type="number"
                  min={1}
                  value={newTemplateDraft.sort_order}
                  onChange={(event) => setNewTemplateDraft((state) => ({ ...state, sort_order: event.target.value }))}
                  disabled={busyKey !== null}
                  className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                />
                <label className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={newTemplateDraft.is_active}
                    onChange={(event) => setNewTemplateDraft((state) => ({ ...state, is_active: event.target.checked }))}
                    disabled={busyKey !== null}
                    className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
                  />
                  Активный
                </label>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => void createTemplate()}
                  disabled={busyKey !== null}
                  className="rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1f4f92] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Добавить шаблон
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 2xl:grid-cols-2">
          {payload.templates.map((template) => {
            const isEditing = editingTemplateId === template.id;
            const draft = templateDrafts[template.id] || templateDraftFromRecord(template);
            return (
              <div key={template.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold text-ink">{template.title}</h4>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${template.is_active ? 'bg-brandSoft text-brand' : 'bg-line text-muted'}`}>
                        {template.is_active ? 'Активный' : 'Отключён'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">Порядок: {template.sort_order}</p>
                  </div>
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingTemplateId(isEditing ? null : template.id)}
                        className="rounded-2xl border border-brand/20 bg-brandSoft px-4 py-2 text-sm font-semibold text-brand transition hover:border-brand/40"
                      >
                        {isEditing ? 'Закрыть' : 'Редактировать'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteTemplate(template.id, template.title)}
                        disabled={busyKey !== null}
                        className="rounded-2xl border border-accent/25 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition hover:border-accent/45 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Удалить
                      </button>
                    </div>
                  ) : null}
                </div>

                {isEditing ? (
                  <div className="mt-4 grid gap-3">
                    <input
                      value={draft.title}
                      onChange={(event) => updateTemplateDraft(template.id, { title: event.target.value })}
                      disabled={busyKey !== null}
                      className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <textarea
                      value={draft.message}
                      onChange={(event) => updateTemplateDraft(template.id, { message: event.target.value })}
                      rows={5}
                      disabled={busyKey !== null}
                      className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <div className="grid gap-3 md:grid-cols-[1fr_180px_160px]">
                      <input
                        value={draft.scripture}
                        onChange={(event) => updateTemplateDraft(template.id, { scripture: event.target.value })}
                        disabled={busyKey !== null}
                        className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <input
                        type="number"
                        min={1}
                        value={draft.sort_order}
                        onChange={(event) => updateTemplateDraft(template.id, { sort_order: event.target.value })}
                        disabled={busyKey !== null}
                        className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <label className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={draft.is_active}
                          onChange={(event) => updateTemplateDraft(template.id, { is_active: event.target.checked })}
                          disabled={busyKey !== null}
                          className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
                        />
                        Активный
                      </label>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => void saveTemplate(template.id)}
                        disabled={busyKey !== null}
                        className="rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1f4f92] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Сохранить шаблон
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-line bg-panel p-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-ink">{template.message}</pre>
                    {template.scripture ? <p className="mt-4 text-sm font-medium text-brand">{template.scripture}</p> : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
