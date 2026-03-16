'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  apiFetch,
  AuthResponse,
  InstructionChecklistItemRecord,
  InstructionCollectionResponse,
  InstructionRecord,
  UserRecord
} from '@/lib/api';

type InstructionDraft = {
  title: string;
  summary: string;
  content: string;
  checklistText: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value));
}

function buildDraft(item: InstructionRecord): InstructionDraft {
  return {
    title: item.title,
    summary: item.summary || '',
    content: item.content,
    checklistText: item.checklist.map((entry) => entry.text).join('\n')
  };
}

function countDone(item: InstructionRecord) {
  return item.checklist.filter((entry) => Boolean(entry.id) && item.checked_item_ids.includes(entry.id as string)).length;
}

export function InstructionsManagement() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [payload, setPayload] = useState<InstructionCollectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, InstructionDraft>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManage = currentUser?.role === 'creator' || currentUser?.role === 'admin';

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [me, instructions] = await Promise.all([
        apiFetch<AuthResponse>('/auth/me'),
        apiFetch<InstructionCollectionResponse>('/instructions')
      ]);
      setCurrentUser(me.user);
      setPayload(instructions);
      const nextDrafts: Record<number, InstructionDraft> = {};
      for (const item of instructions.items) {
        nextDrafts[item.id] = buildDraft(item);
      }
      setDrafts(nextDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить инструктажи');
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

  const myItems = useMemo(() => (payload?.items || []).filter((item) => item.assigned_to_me), [payload?.items]);

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

  function updateDraft(id: number, patch: Partial<InstructionDraft>) {
    setDrafts((state) => ({
      ...state,
      [id]: {
        ...(state[id] || { title: '', summary: '', content: '', checklistText: '' }),
        ...patch
      }
    }));
  }

  async function saveInstruction(item: InstructionRecord) {
    const draft = drafts[item.id];
    const lines = draft.checklistText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const checklist: InstructionChecklistItemRecord[] = lines.map((text, index) => ({
      id: item.checklist[index]?.id || null,
      text
    }));

    await runAction(
      `instruction:${item.id}`,
      () =>
        apiFetch<InstructionCollectionResponse>(`/instructions/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: draft.title,
            summary: draft.summary || null,
            content: draft.content,
            checklist
          })
        }).then(() => undefined),
      'Инструктаж сохранён'
    );
    setEditingId(null);
  }

  async function toggleChecklist(item: InstructionRecord, checklistItemId: string, checked: boolean) {
    const nextIds = checked
      ? [...item.checked_item_ids, checklistItemId]
      : item.checked_item_ids.filter((id) => id !== checklistItemId);

    await runAction(
      `progress:${item.id}:${checklistItemId}`,
      () =>
        apiFetch<InstructionCollectionResponse>(`/instructions/${item.id}/progress`, {
          method: 'PUT',
          body: JSON.stringify({ checked_item_ids: Array.from(new Set(nextIds)) })
        }).then(() => undefined),
      'Чек-лист обновлён'
    );
  }

  if (loading || !payload) {
    return (
      <section className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
        <p className="text-sm text-muted">Загрузка инструктажей...</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-line/70 bg-panel p-5 shadow-panel lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Инструктажи</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Чек-листы на служение</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                Материалы привязаны к позициям. Пользователь отмечает выполнение по текущему служению, а админ редактирует содержание и пункты чек-листа.
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink">
              {formatDate(payload.service_date)}
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-accent">{error}</div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-2xl border border-brand/20 bg-brandSoft px-4 py-3 text-sm text-brand">{success}</div>
          ) : null}

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Всего инструктажей</p>
              <p className="mt-2 text-lg font-semibold text-ink">{payload.items.length}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Мои позиции</p>
              <p className="mt-2 text-lg font-semibold text-ink">{myItems.length}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Редактирование</p>
              <p className="mt-2 text-lg font-semibold text-ink">{canManage ? 'Доступно' : 'Только просмотр'}</p>
            </div>
          </div>
        </div>

        <aside className="rounded-[28px] border border-line/70 bg-[#18304f] p-5 text-white shadow-panel lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Мои инструкции</p>
          {myItems.length === 0 ? (
            <p className="mt-4 text-sm leading-7 text-white/76">На текущее служение тебе пока не назначены позиции. Можно изучить общий каталог инструкций ниже.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {myItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/12 bg-white/8 p-4">
                  <p className="text-sm font-semibold">{item.position_name}</p>
                  <p className="mt-2 text-sm text-white/74">{countDone(item)} из {item.checklist.length} пунктов отмечено</p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </section>

      <section className="grid gap-4">
        {payload.items.map((item) => {
          const isEditing = editingId === item.id;
          const draft = drafts[item.id] || buildDraft(item);
          return (
            <div key={item.id} className={`rounded-[28px] border p-5 shadow-panel lg:p-6 ${item.assigned_to_me ? 'border-brand/30 bg-brandSoft/40' : 'border-line/70 bg-panel'}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">{item.position_name}</p>
                    {item.assigned_to_me ? (
                      <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">Назначено мне</span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold text-ink">{item.title}</h3>
                  {item.summary ? <p className="mt-3 text-sm leading-7 text-muted">{item.summary}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-muted">
                    {countDone(item)} / {item.checklist.length} выполнено
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : item.id)}
                      className="rounded-2xl border border-brand/20 bg-brandSoft px-4 py-3 text-sm font-semibold text-brand transition hover:border-brand/40"
                    >
                      {isEditing ? 'Закрыть редактор' : 'Редактировать'}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-line bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Описание</p>
                  {isEditing ? (
                    <div className="mt-4 grid gap-3">
                      <input
                        value={draft.title}
                        onChange={(event) => updateDraft(item.id, { title: event.target.value })}
                        disabled={busyKey !== null}
                        className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Заголовок"
                      />
                      <textarea
                        value={draft.summary}
                        onChange={(event) => updateDraft(item.id, { summary: event.target.value })}
                        disabled={busyKey !== null}
                        rows={3}
                        className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Короткое описание"
                      />
                      <textarea
                        value={draft.content}
                        onChange={(event) => updateDraft(item.id, { content: event.target.value })}
                        disabled={busyKey !== null}
                        rows={7}
                        className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Основной текст"
                      />
                    </div>
                  ) : (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink">{item.content}</p>
                  )}
                </div>

                <div className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Чек-лист</p>
                    {isEditing && canManage ? (
                      <button
                        type="button"
                        onClick={() => void saveInstruction(item)}
                        disabled={busyKey !== null}
                        className="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1f4f92] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Сохранить
                      </button>
                    ) : null}
                  </div>

                  {isEditing ? (
                    <textarea
                      value={draft.checklistText}
                      onChange={(event) => updateDraft(item.id, { checklistText: event.target.value })}
                      disabled={busyKey !== null}
                      rows={10}
                      className="mt-4 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="Один пункт в каждой строке"
                    />
                  ) : (
                    <div className="mt-4 space-y-3">
                      {item.checklist.map((entry, index) => {
                        const checked = Boolean(entry.id) && item.checked_item_ids.includes(entry.id as string);
                        return (
                          <label key={entry.id || `${item.id}-${index}`} className="flex items-start gap-3 rounded-2xl border border-line bg-panel px-4 py-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={busyKey !== null || !entry.id}
                              onChange={(event) => entry.id && void toggleChecklist(item, entry.id, event.target.checked)}
                              className="mt-1 h-4 w-4 rounded border-line text-brand focus:ring-brand"
                            />
                            <span className={`text-sm leading-6 ${checked ? 'text-ink' : 'text-muted'}`}>{entry.text}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
