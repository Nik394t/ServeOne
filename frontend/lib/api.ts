const API_BASE_STORAGE_KEY = 'serveone-cloud-api-base-url';
const API_QUERY_PARAM = 'api';
const DEFAULT_PROXY_API_BASE = '/api/backend';
let refreshRequest: Promise<boolean> | null = null;

function normalizeApiBase(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/$/, '');
}

function normalizeBasePath(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') return '';
  const normalized = trimmed.replace(/^\/+|\/+$/g, '');
  return normalized ? `/${normalized}` : '';
}

function readQueryApiBase(): string | null {
  if (typeof window === 'undefined') return null;
  return normalizeApiBase(new URLSearchParams(window.location.search).get(API_QUERY_PARAM));
}

function readStoredApiBase(): string | null {
  if (typeof window === 'undefined') return null;
  return normalizeApiBase(window.localStorage.getItem(API_BASE_STORAGE_KEY));
}

export function getExplicitApiBase(): string | null {
  const fromEnv = normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE_URL);
  if (typeof window === 'undefined') return fromEnv;

  const fromQuery = readQueryApiBase();
  if (fromQuery) {
    window.localStorage.setItem(API_BASE_STORAGE_KEY, fromQuery);
    return fromQuery;
  }

  return readStoredApiBase() || fromEnv;
}

export function getRuntimeApiBase(): string {
  return getExplicitApiBase() || DEFAULT_PROXY_API_BASE;
}

export function saveRuntimeApiBase(value: string): string {
  if (typeof window === 'undefined') {
    throw new Error('Runtime API URL можно сохранить только в браузере');
  }
  const normalized = normalizeApiBase(value);
  if (!normalized) {
    throw new Error('Укажи корректный Cloud API URL');
  }
  window.localStorage.setItem(API_BASE_STORAGE_KEY, normalized);
  return normalized;
}

export function clearRuntimeApiBase(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(API_BASE_STORAGE_KEY);
}

export function getAppBasePath(): string {
  return normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
}

export function withAppBasePath(path: string): string {
  const basePath = getAppBasePath();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${normalizedPath}` || '/';
}

function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getRuntimeApiBase()}${normalizedPath}`;
}

function buildRequestInit(init?: RequestInit): RequestInit {
  return {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    },
    cache: 'no-store'
  };
}

function shouldAttemptRefresh(path: string, status: number): boolean {
  if (status !== 401) return false;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return !['/auth/login', '/auth/logout', '/auth/refresh'].includes(normalizedPath);
}

async function tryRefreshSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!refreshRequest) {
    refreshRequest = fetch(buildApiUrl('/auth/refresh'), buildRequestInit({ method: 'POST' }))
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

export async function apiFetch<T>(path: string, init?: RequestInit, options?: { skipRefresh?: boolean }): Promise<T> {
  const response = await fetch(buildApiUrl(path), buildRequestInit(init));

  if (!response.ok && !options?.skipRefresh && shouldAttemptRefresh(path, response.status)) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return apiFetch<T>(path, init, { skipRefresh: true });
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.detail || 'Request failed';
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export type AuthUser = {
  id: number;
  login: string;
  full_name: string | null;
  role: 'creator' | 'admin' | 'user' | 'deleted';
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AuthResponse = {
  user: AuthUser;
};

export type UserRecord = AuthUser;

export type UserCreatePayload = {
  login: string;
  full_name: string | null;
  password: string;
  role: 'creator' | 'admin' | 'user' | 'deleted';
};

export type UserUpdatePayload = {
  full_name?: string | null;
  password?: string | null;
  is_active?: boolean;
};

export type PositionRecord = {
  id: number;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type HoldRecord = {
  id: number;
  position_id: number;
  user_id: number;
  remaining: number;
};

export type AssignmentRecord = {
  id: number;
  week_id: string;
  service_date: string;
  position_id: number;
  position_code: string;
  position_name: string;
  user_id: number | null;
  partner_user_id: number | null;
  hold: HoldRecord | null;
};

export type ScheduleWeekResponse = {
  week_id: string;
  service_date: string;
  is_completed: boolean;
  positions: PositionRecord[];
  users: UserRecord[];
  assignments: AssignmentRecord[];
};

export type DutyMemberRecord = {
  id: number;
  user_id: number;
  sort_order: number;
  user: UserRecord;
};

export type DutyHistoryRecord = {
  id: number;
  previous_user_id: number | null;
  previous_user_name: string | null;
  current_user_id: number | null;
  current_user_name: string | null;
  reason: 'auto' | 'manual' | string;
  note: string | null;
  advanced_at: string;
};

export type DutyOverviewResponse = {
  current_user_id: number | null;
  current_user_name: string | null;
  next_user_id: number | null;
  next_user_name: string | null;
  queue: DutyMemberRecord[];
  users: UserRecord[];
  history: DutyHistoryRecord[];
  last_auto_advance: string | null;
};

export type InstructionChecklistItemRecord = {
  id: string | null;
  text: string;
};

export type InstructionRecord = {
  id: number;
  position_id: number;
  position_code: string;
  position_name: string;
  position_sort_order: number;
  title: string;
  summary: string | null;
  content: string;
  checklist: InstructionChecklistItemRecord[];
  checked_item_ids: string[];
  assigned_to_me: boolean;
  updated_at: string;
};

export type InstructionCollectionResponse = {
  service_date: string;
  items: InstructionRecord[];
};

export type BirthdayPersonRecord = {
  user: UserRecord;
  birth_date: string | null;
  genitive_name: string | null;
  address_form: 'brother' | 'sister' | null;
  note: string | null;
  next_birthday: string | null;
  days_until: number | null;
};

export type BirthdayTemplateRecord = {
  id: number;
  title: string;
  message: string;
  scripture: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BirthdayCollectionResponse = {
  today: string;
  people: BirthdayPersonRecord[];
  templates: BirthdayTemplateRecord[];
};

export type BirthdayBroadcastPersonRecord = {
  user_id: number;
  display_name: string;
  birth_date: string | null;
  genitive_name: string | null;
  address_form: 'brother' | 'sister' | null;
};

export type BroadcastHistoryRecord = {
  id: number;
  kind: string;
  title: string;
  body: string;
  target_mode: string;
  created_at: string;
  created_by_user_name: string | null;
  recipient_count: number;
  recipients: string[];
};

export type BroadcastCollectionResponse = {
  users: UserRecord[];
  birthday_people: BirthdayBroadcastPersonRecord[];
  history: BroadcastHistoryRecord[];
};

export type MessageContactRecord = {
  id: number;
  display_name: string;
  role: string;
};

export type MessageItemRecord = {
  kind: 'broadcast' | 'direct';
  record_id: number;
  title: string;
  body: string;
  created_at: string;
  is_read: boolean;
  direction: 'incoming' | 'outgoing' | 'system';
  sender_user: UserRecord | null;
  recipient_user: UserRecord | null;
};

export type MessageCollectionResponse = {
  items: MessageItemRecord[];
  contacts: MessageContactRecord[];
  unread_count: number;
};

export type PushSubscriptionRecord = {
  id: number;
  endpoint: string;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
};

export type PushStateResponse = {
  enabled: boolean;
  public_key: string | null;
  vapid_subject: string | null;
  subscription_count: number;
  subscriptions: PushSubscriptionRecord[];
};

export type PushTestResponse = {
  sent: number;
  removed: number;
  failed: number;
  subscriptions: PushSubscriptionRecord[];
};

export type ReportTeamMetrics = {
  total_users: number;
  active_users: number;
  inactive_users: number;
  admins: number;
  creators: number;
  birthday_profiles: number;
  push_subscriptions: number;
};

export type ReportServiceMetrics = {
  total_positions: number;
  total_weeks: number;
  completed_weeks: number;
  upcoming_week_id: string;
  upcoming_service_date: string;
  upcoming_assigned: number;
  upcoming_unassigned: number;
  upcoming_partners: number;
  active_holds: number;
};

export type ReportCommunicationMetrics = {
  broadcast_campaigns: number;
  broadcast_recipients: number;
  inbox_messages: number;
  unread_inbox_messages: number;
  direct_messages: number;
  unread_direct_messages: number;
};

export type ReportDutyMetrics = {
  queue_size: number;
  current_user_name: string | null;
  next_user_name: string | null;
  advances_total: number;
  auto_advances: number;
  manual_advances: number;
  last_advance_at: string | null;
};

export type ReportInstructionMetrics = {
  guides_total: number;
  progress_records_total: number;
  current_week_progress_records: number;
  current_week_completion_rate: number;
};

export type ReportUpcomingBirthday = {
  user_id: number;
  display_name: string;
  next_birthday: string;
  days_until: number;
  address_form: string | null;
};

export type ReportServiceLoad = {
  user_id: number;
  display_name: string;
  role: string;
  assignments_main: number;
  assignments_partner: number;
  hold_positions: number;
  total_load: number;
};

export type ReportUpcomingAssignment = {
  position_name: string;
  user_name: string | null;
  partner_user_name: string | null;
  hold_remaining: number | null;
};

export type ReportDutyHistoryItem = {
  previous_user_name: string | null;
  current_user_name: string | null;
  reason: string;
  note: string | null;
  advanced_at: string;
};

export type ReportOverviewResponse = {
  generated_at: string;
  team: ReportTeamMetrics;
  service: ReportServiceMetrics;
  communication: ReportCommunicationMetrics;
  duty: ReportDutyMetrics;
  instructions: ReportInstructionMetrics;
  upcoming_birthdays: ReportUpcomingBirthday[];
  top_service_users: ReportServiceLoad[];
  upcoming_assignments: ReportUpcomingAssignment[];
  recent_duty_history: ReportDutyHistoryItem[];
};
