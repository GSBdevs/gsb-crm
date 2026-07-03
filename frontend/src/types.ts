export type Role = "admin" | "manager" | "rep";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export type LeadStatus = "new" | "qualified" | "converted" | "lost";

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  status: LeadStatus;
  score: number;
  notes: string;
  converted_at: string | null;
  converted_contact_id: string | null;
  converted_opportunity_id: string | null;
  created_at: string;
  updated_at: string;
}

export type AccountSize = "S" | "M" | "L" | "XL";

export interface Account {
  id: string;
  name: string;
  domain: string;
  industry: string;
  size: AccountSize;
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string;
  tags: string[];
  score: number;
  custom_fields: Record<string, unknown>;
  account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Stage {
  id: string;
  name: string;
  position: number;
  color: string;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
}

export interface Opportunity {
  id: string;
  title: string;
  value: number;
  probability: number;
  expected_close: string | null;
  position: number;
  closed_at: string | null;
  stage_id: string;
  contact_id: string | null;
  account_id: string | null;
  created_at: string;
  updated_at: string;
  contact_name?: string | null;
  account_name?: string | null;
}

export type ActivityType = "call" | "email" | "meeting" | "task";

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  notes: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label?: string | null;
  due_at: string | null;
  done_at: string | null;
  user_id: string | null;
  created_at: string;
}

export interface Condition {
  field: string;
  op: string;
  value: unknown;
}

export type ActionType = "create_activity" | "notify" | "send_email" | "webhook";

export interface ActionSpec {
  type: ActionType;
  params: Record<string, string | number>;
}

export interface WorkflowRule {
  id: string;
  name: string;
  trigger_event: string;
  conditions: Condition[];
  actions: ActionSpec[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  rule_id: string;
  event: string;
  entity_type: string;
  entity_id: string | null;
  status: string;
  detail: string;
  executed_at: string;
}

export interface WorkflowMeta {
  triggers: Record<string, string[]>;
  actions: Record<string, Record<string, string>>;
}

export interface AppNotification {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface Summary {
  open_leads: number;
  qualified_leads: number;
  open_opportunities: number;
  open_value: number;
  won_value_month: number;
  activities_due_today: number;
  activities_overdue: number;
  contacts_total: number;
}

export interface StageMetric {
  stage: string;
  color: string;
  count: number;
  value: number;
}

export interface TimeSeriesPoint {
  period: string;
  created: number;
  converted: number;
}

export interface ActivityDayPoint {
  day: string;
  call: number;
  email: number;
  meeting: number;
  task: number;
}

export interface ForecastPoint {
  period: string;
  weighted: number;
  total: number;
}
