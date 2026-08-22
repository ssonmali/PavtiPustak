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
  user_id: string;
};

/** Columns the volunteer fills in; the rest are server-assigned. */
export type ReceiptInput = Pick<
  Receipt,
  "donor_name" | "amount" | "phone_number" | "payment_method" | "collection_date"
>;

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
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
