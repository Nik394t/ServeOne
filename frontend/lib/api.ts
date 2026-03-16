export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    },
    cache: 'no-store'
  });

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
