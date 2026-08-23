/** Payment methods accepted at the mandal — mirrors the DB check constraint. */
export const PAYMENT_METHODS = ["Cash", "UPI"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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
  "donor_name" | "amount" | "phone_number" | "payment_method" | "collection_date"
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
      volunteer_names: {
        Row: VolunteerName;
        Insert: Pick<VolunteerName, "email" | "display_name">;
        Update: Pick<VolunteerName, "display_name">;
        Relationships: [];
      };
      receipt_audit: {
        Row: AuditEntry;
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
    };
    Functions: {
      /** Trivial round-trip used by the daily keep-alive; touches no table. */
      ping: { Args: Record<string, never>; Returns: string };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
