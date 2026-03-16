'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiFetch, AuthResponse, UserCreatePayload, UserRecord, UserUpdatePayload } from '@/lib/api';

const roleLabels: Record<UserRecord['role'], string> = {
  creator: 'Создатель',
  admin: 'Админ',
  user: 'Пользователь',
  deleted: 'Удалён'
};

type CreateState = {
  login: string;
  full_name: string;
  password: string;
  role: 'admin' | 'user';
};

type EditState = {
  id: number;
  full_name: string;
  password: string;
  is_active: boolean;
};

const initialCreateState: CreateState = {
  login: '',
  full_name: '',
  password: '',
  role: 'user'
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ru-RU');
}

function StatCard({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'brand' | 'accent' }) {
  const accentClass =
    tone === 'brand'
      ? 'text-brand'
      : tone === 'accent'
        ? 'text-accent'
        : 'text-ink';

  return (
    <div className="metric-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className={`mt-3 text-[28px] font-semibold leading-none ${accentClass}`}>{value}</p>
    </div>
  );
}

function filterFieldClass() {
  return 'w-full rounded-2xl border border-line/70 bg-white/75 px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:bg-white';
}

export function UsersManagement() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'creator' | 'admin' | 'user'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreate, setShowCreate] = useState(true);
  const [createForm, setCreateForm] = useState<CreateState>(initialCreateState);
  const [editing, setEditing] = useState<EditState | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [me, list] = await Promise.all([
        apiFetch<AuthResponse>('/auth/me'),
        apiFetch<UserRecord[]>('/users')
      ]);
      setCurrentUser(me.user);
      setUsers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить участников');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!success) {
      return;
    }
    const timer = window.setTimeout(() => setSuccess(null), 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const haystack = [user.login, user.full_name || '', roleLabels[user.role]].join(' ').toLowerCase();
      const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.is_active) ||
        (statusFilter === 'inactive' && !user.is_active);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter, users]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((user) => user.is_active).length;
    const admins = users.filter((user) => user.role === 'admin').length;
    const creators = users.filter((user) => user.role === 'creator').length;
    return { total, active, admins, creators };
  }, [users]);

  const canCreateAdmin = currentUser?.role === 'creator';

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: UserCreatePayload = {
        login: createForm.login.trim(),
        full_name: createForm.full_name.trim() || null,
        password: createForm.password,
        role: canCreateAdmin ? createForm.role : 'user'
      };
      await apiFetch<UserRecord>('/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setCreateForm(initialCreateState);
      setSuccess('Пользователь создан');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать пользователя');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload: UserUpdatePayload = {
        full_name: editing.full_name.trim() || null,
        is_active: editing.is_active
      };
      if (editing.password.trim()) {
        payload.password = editing.password.trim();
      }
      await apiFetch<UserRecord>(`/users/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setEditing(null);
      setSuccess('Изменения сохранены');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить изменения');
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(target: UserRecord, nextRole: 'admin' | 'user') {
    if (!window.confirm(`Изменить роль для ${target.full_name || target.login}?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch<UserRecord>(`/users/${target.id}/role`, {
        method: 'POST',
        body: JSON.stringify({ role: nextRole })
      });
      setSuccess('Роль обновлена');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить роль');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(target: UserRecord) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch<UserRecord>(`/users/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !target.is_active })
      });
      setSuccess(target.is_active ? 'Пользователь деактивирован' : 'Пользователь активирован');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить статус');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(target: UserRecord) {
    if (!window.confirm(`Удалить пользователя ${target.full_name || target.login}?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch<{ status: string }>(`/users/${target.id}`, {
        method: 'DELETE'
      });
      setSuccess('Пользователь удалён');
      if (editing?.id === target.id) {
        setEditing(null);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить пользователя');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="surface-card rounded-[30px] p-5 lg:p-6">
        <p className="text-sm text-muted">Загрузка участников...</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Всего пользователей" value={stats.total} />
        <StatCard label="Активных" value={stats.active} tone="brand" />
        <StatCard label="Админов" value={stats.admins} />
        <StatCard label="Создателей" value={stats.creators} tone="accent" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="surface-card rounded-[30px] p-5 lg:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <span className="dashboard-chip">Участники</span>
              <h2 className="mt-3 text-2xl font-semibold text-ink">Управление командой</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                Здесь creator и admin управляют доступом, активностью и профилями пользователей. Назначение админов доступно только creator.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate((value) => !value)}
              className="rounded-2xl border border-line/70 bg-white/80 px-4 py-3 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
            >
              {showCreate ? 'Скрыть форму создания' : 'Создать пользователя'}
            </button>
          </div>

          <div className="mt-6 grid gap-3 xl:grid-cols-[1.2fr_0.45fr_0.45fr]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по логину, имени или роли"
              className={filterFieldClass()}
            />
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
              className={filterFieldClass()}
            >
              <option value="all">Все роли</option>
              <option value="creator">Создатель</option>
              <option value="admin">Админ</option>
              <option value="user">Пользователь</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className={filterFieldClass()}
            >
              <option value="all">Все статусы</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </select>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-accent">{error}</div>
          ) : null}

          {success ? (
            <div className="mt-4 rounded-2xl border border-brand/20 bg-brandSoft px-4 py-3 text-sm text-brand">{success}</div>
          ) : null}

          <div className="mt-6 space-y-3">
            {filteredUsers.length === 0 ? (
              <div className="surface-card-strong rounded-[24px] border border-dashed border-line/70 px-4 py-6 text-sm text-muted">
                По текущим фильтрам никого не найдено.
              </div>
            ) : null}

            {filteredUsers.map((user) => {
              const isEditing = editing?.id === user.id;
              const canDelete = currentUser && currentUser.id !== user.id && user.role !== 'creator' && (currentUser.role === 'creator' || user.role === 'user');
              const canChangeRole = currentUser?.role === 'creator' && user.role !== 'creator' && currentUser.id !== user.id;
              const canEdit = currentUser?.role === 'creator' || user.role === 'user';

              return (
                <div key={user.id} className="surface-card-strong rounded-[26px] p-4 lg:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-ink">{user.full_name || 'Без имени'}</h3>
                        <span className="dashboard-chip">{roleLabels[user.role]}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            user.is_active ? 'bg-brandSoft text-brand' : 'bg-accent/10 text-accent'
                          }`}
                        >
                          {user.is_active ? 'Активен' : 'Неактивен'}
                        </span>
                      </div>
                      <div className="grid gap-3 text-sm text-muted sm:grid-cols-3">
                        <div className="rounded-2xl border border-line/60 bg-white/70 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted/80">Логин</p>
                          <p className="mt-1.5 text-sm font-semibold text-ink">{user.login}</p>
                        </div>
                        <div className="rounded-2xl border border-line/60 bg-white/70 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted/80">Создан</p>
                          <p className="mt-1.5 text-sm font-semibold text-ink">{formatDateTime(user.created_at)}</p>
                        </div>
                        <div className="rounded-2xl border border-line/60 bg-white/70 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted/80">Обновлён</p>
                          <p className="mt-1.5 text-sm font-semibold text-ink">{formatDateTime(user.updated_at)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:min-w-[320px] xl:grid-cols-1">
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => setEditing({ id: user.id, full_name: user.full_name || '', password: '', is_active: user.is_active })}
                          className="w-full rounded-2xl border border-line/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
                        >
                          Редактировать
                        </button>
                      ) : null}

                      {canChangeRole ? (
                        <button
                          type="button"
                          onClick={() => handleRoleChange(user, user.role === 'admin' ? 'user' : 'admin')}
                          className="w-full rounded-2xl border border-line/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
                          disabled={busy}
                        >
                          {user.role === 'admin' ? 'Сделать пользователем' : 'Сделать админом'}
                        </button>
                      ) : null}

                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => handleToggleActive(user)}
                          className="w-full rounded-2xl border border-line/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
                          disabled={busy}
                        >
                          {user.is_active ? 'Деактивировать' : 'Активировать'}
                        </button>
                      ) : null}

                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          className="w-full rounded-2xl border border-accent/25 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/15 disabled:opacity-60"
                          disabled={busy}
                        >
                          Удалить
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {isEditing ? (
                    <form onSubmit={handleSaveEdit} className="mt-5 grid gap-3 rounded-[24px] border border-line/70 bg-white/65 p-4 lg:grid-cols-3">
                      <label className="space-y-2 lg:col-span-1">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Имя</span>
                        <input
                          value={editing.full_name}
                          onChange={(event) => setEditing((state) => (state ? { ...state, full_name: event.target.value } : state))}
                          className={filterFieldClass()}
                        />
                      </label>
                      <label className="space-y-2 lg:col-span-1">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Новый пароль</span>
                        <input
                          type="password"
                          value={editing.password}
                          onChange={(event) => setEditing((state) => (state ? { ...state, password: event.target.value } : state))}
                          placeholder="Оставь пустым, чтобы не менять"
                          className={filterFieldClass()}
                        />
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-line/70 bg-white/75 px-4 py-3 text-sm text-muted lg:col-span-1 lg:self-end">
                        <input
                          type="checkbox"
                          checked={editing.is_active}
                          onChange={(event) => setEditing((state) => (state ? { ...state, is_active: event.target.checked } : state))}
                          className="h-4 w-4 rounded border-line"
                        />
                        Пользователь активен
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row lg:col-span-3">
                        <button
                          type="submit"
                          disabled={busy}
                          className="rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1f4f92] disabled:opacity-70"
                        >
                          {busy ? 'Сохранение...' : 'Сохранить'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="rounded-2xl border border-line/70 bg-white/80 px-4 py-3 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
                        >
                          Отмена
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          {showCreate ? (
            <form onSubmit={handleCreate} className="surface-card-dark rounded-[30px] p-5 text-white lg:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Новый пользователь</p>
              <h3 className="mt-3 text-2xl font-semibold">Создать доступ</h3>
              <div className="mt-5 space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm text-white/75">Логин</span>
                  <input
                    value={createForm.login}
                    onChange={(event) => setCreateForm((state) => ({ ...state, login: event.target.value }))}
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none transition focus:border-white/35"
                    required
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm text-white/75">Имя</span>
                  <input
                    value={createForm.full_name}
                    onChange={(event) => setCreateForm((state) => ({ ...state, full_name: event.target.value }))}
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none transition focus:border-white/35"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm text-white/75">Пароль</span>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(event) => setCreateForm((state) => ({ ...state, password: event.target.value }))}
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none transition focus:border-white/35"
                    required
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm text-white/75">Роль</span>
                  <select
                    value={canCreateAdmin ? createForm.role : 'user'}
                    onChange={(event) => setCreateForm((state) => ({ ...state, role: event.target.value as CreateState['role'] }))}
                    disabled={!canCreateAdmin}
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none transition focus:border-white/35 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {canCreateAdmin ? <option value="admin" className="text-ink">Админ</option> : null}
                    <option value="user" className="text-ink">Пользователь</option>
                  </select>
                </label>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="mt-6 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#18304f] transition hover:bg-[#f2f6fb] disabled:opacity-70"
              >
                {busy ? 'Создание...' : 'Создать пользователя'}
              </button>
            </form>
          ) : null}

          <div className="surface-card rounded-[30px] p-5 lg:p-6">
            <span className="dashboard-chip">Правила доступа</span>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-line/60 bg-white/70 px-4 py-3 text-sm leading-7 text-muted">
                1. Создатель может создавать админов и обычных пользователей.
              </div>
              <div className="rounded-2xl border border-line/60 bg-white/70 px-4 py-3 text-sm leading-7 text-muted">
                2. Админ создаёт только обычных пользователей.
              </div>
              <div className="rounded-2xl border border-line/60 bg-white/70 px-4 py-3 text-sm leading-7 text-muted">
                3. Creator не может понизить самого себя.
              </div>
              <div className="rounded-2xl border border-line/60 bg-white/70 px-4 py-3 text-sm leading-7 text-muted">
                4. Удаление пользователей мягкое: история сохраняется.
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
