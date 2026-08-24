/** Payment methods accepted at the mandal — mirrors the DB check constraint. */
export const PAYMENT_METHODS = ["Cash", "UPI"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Whether the money actually arrived. An `Unpaid` row is a promise: it is
 * recorded so it can be chased, and is excluded from every collected figure.
 */
export const PAYMENT_STATUSES = ["Paid", "Unpaid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** A row of `public.receipts` exactly as Postgres returns it. */
export type Receipt = {
  id: string;
  receipt_number: number;
  donor_name: string;
  /** numeric(12,2) — supabase-js hands this back as a JS number. */
  amount: number;
  phone_number: string;
  payment_method: PaymentMethod;
  /** `YYYY-MM-DD`, may be backdated. */
  collection_date: string;
  created_at: string;
  /** Bumped by a trigger on every update; used for optimistic locking. */
  updated_at: string;
  user_id: string;
  /** Email of the volunteer who created the receipt, set by a trigger. */
  created_by_email: string | null;
  payment_status: PaymentStatus;
  /** When the money is expected. Set if and only if the row is `Unpaid`. */
  due_on: string | null;
};

/** Spending categories the mandal uses — mirrors the DB check constraint. */
export const EXPENSE_CATEGORIES = [
  "Decoration",
  "Prasad",
  "Food",
  "Sound",
  "Idol",
  "Mandap",
  "Electricity",
  "Other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** A row of `public.expenses` exactly as Postgres returns it. */
export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  payment_method: PaymentMethod;
  /** `YYYY-MM-DD`, may be backdated like a receipt. */
  spent_on: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  created_by_email: string | null;
};

/** Columns the volunteer fills in; the rest are server-assigned. */
export type ExpenseInput = Pick<
  Expense,
  "description" | "amount" | "category" | "payment_method" | "spent_on" | "note"
>;

/**
 * A row of `public.donations` — the donation box. Kept fully separate from
 * receipts and expenses: an in-kind item log, not a cash ledger, so `value`
 * is an optional note for the record rather than a figure ever totalled
 * alongside contributions.
 */
export type Donation = {
  id: string;
  donation_number: number;
  donor_name: string;
  phone_number: string | null;
  item: string;
  value: number | null;
  /** `YYYY-MM-DD`, may be backdated like a receipt. */
  donation_date: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  created_by_email: string | null;
};

/** Columns the volunteer fills in; the rest are server-assigned. */
export type DonationInput = Pick<
  Donation,
  "donor_name" | "phone_number" | "item" | "value" | "donation_date"
>;

/** One row of `public.expense_daily_totals`. */
export type ExpenseDailyTotal = {
  spent_on: string;
  total: number;
  expense_count: number;
};

/** One row of `public.receipt_daily_totals`. */
export type DailyTotal = {
  collection_date: string;
  total: number;
  cash: number;
  upi: number;
  receipt_count: number;
  donor_count: number;
};

/** One row of `public.volunteer_totals`. */
export type VolunteerTotal = {
  volunteer: string;
  total: number;
  receipt_count: number;
  first_collection: string;
  last_collection: string;
};

/**
 * The single row of `public.pledge_totals` — what is promised but not received.
 * `due_now` covers today and anything overdue, which is what gets chased.
 */
export type PledgeTotals = {
  expected: number;
  pledge_count: number;
  due_now: number;
  due_today: number;
  overdue: number;
};

/** One row of `public.donor_directory` — powers donor autocomplete. */
export type Donor = {
  donor_name: string;
  phone_number: string;
  lifetime_total: number;
  receipt_count: number;
  last_collection: string;
};

/** Columns the volunteer fills in; the rest are server-assigned. */
export type ReceiptInput = Pick<
  Receipt,
  | "donor_name"
  | "amount"
  | "phone_number"
  | "payment_method"
  | "collection_date"
  | "payment_status"
  | "due_on"
>;

export type AuditAction = "created" | "updated" | "deleted";

/** One row of `public.receipt_audit`, written by a trigger on every change. */
export type AuditEntry = {
  id: number;
  receipt_id: string | null;
  receipt_number: number | null;
  action: AuditAction;
  actor_id: string | null;
  actor_email: string | null;
  changed_at: string;
  /** Full row snapshot before the change; null for `created`. */
  before: Receipt | null;
  /** Full row snapshot after the change; null for `deleted`. */
  after: Receipt | null;
};

/** One row of `public.volunteer_names` — a volunteer's own display name. */
export type VolunteerName = {
  email: string;
  display_name: string;
  updated_at: string;
};

/** Email → display name, for resolving attribution without a per-row query. */
export type NameMap = Record<string, string>;

/** Which ledger an activity entry belongs to. */
export type ActivityEntity = "receipt" | "expense" | "donation";

/**
 * One row of `public.activity_log` — receipt, expense, and donation audit rows
 * in a single ordered feed.
 *
 * `before`/`after` are whole-row snapshots of two differently shaped tables, so
 * they are read as loose records and narrowed per entity when rendering.
 */
export type ActivityEntry = {
  entity: ActivityEntity;
  /** Unique across the union; `id` alone is not, the sequences are separate. */
  entry_key: string;
  id: number;
  row_id: string | null;
  /** Only ever set for receipts. */
  receipt_number: number | null;
  action: AuditAction;
  actor_id: string | null;
  actor_email: string | null;
  changed_at: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

/** Minimal generated-types shape so every client call is strictly typed. */
export type Database = {
  public: {
    Tables: {
      receipts: {
        Row: Receipt;
        Insert: ReceiptInput & { user_id: string };
        Update: Partial<ReceiptInput>;
        Relationships: [];
      };
      expenses: {
        Row: Expense;
        Insert: ExpenseInput & { user_id: string };
        Update: Partial<ExpenseInput>;
        Relationships: [];
      };
      donations: {
        Row: Donation;
        Insert: DonationInput & { user_id: string };
        Update: Partial<DonationInput>;
        Relationships: [];
      };
      volunteer_names: {
        Row: VolunteerName;
        Insert: Pick<VolunteerName, "email" | "display_name">;
        Update: Pick<VolunteerName, "display_name">;
        Relationships: [];
      };
      expense_audit: {
        Row: {
          id: number;
          expense_id: string | null;
          action: AuditAction;
          actor_id: string | null;
          actor_email: string | null;
          changed_at: string;
          before: Record<string, unknown> | null;
          after: Record<string, unknown> | null;
        };
        // Written only by the database trigger, never from the client.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      receipt_audit: {
        Row: AuditEntry;
        // Written only by the database trigger, never from the client.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      donation_audit: {
        Row: {
          id: number;
          donation_id: string | null;
          action: AuditAction;
          actor_id: string | null;
          actor_email: string | null;
          changed_at: string;
          before: Record<string, unknown> | null;
          after: Record<string, unknown> | null;
        };
        // Written only by the database trigger, never from the client.
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      receipt_daily_totals: { Row: DailyTotal; Relationships: [] };
      volunteer_totals: { Row: VolunteerTotal; Relationships: [] };
      donor_directory: { Row: Donor; Relationships: [] };
      expense_daily_totals: { Row: ExpenseDailyTotal; Relationships: [] };
      activity_log: { Row: ActivityEntry; Relationships: [] };
      pledge_totals: { Row: PledgeTotals; Relationships: [] };
    };
    Functions: {
      /** Trivial round-trip used by the daily keep-alive; touches no table. */
      ping: { Args: Record<string, never>; Returns: string };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
