import { describe, expect, it } from "vitest";
import { categoryTotals } from "@/app/dashboard/expenses/category-totals";
import type { Expense } from "@/lib/types";

function expense(partial: Partial<Expense>): Expense {
  return {
    id: crypto.randomUUID(),
    description: "Something",
    amount: 100,
    category: "Other",
    payment_method: "Cash",
    spent_on: "2026-09-01",
    note: null,
    created_by_email: "a@b.com",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...partial,
  } as Expense;
}

describe("categoryTotals", () => {
  it("returns nothing for an empty ledger", () => {
    expect(categoryTotals([])).toEqual([]);
  });

  it("sums several expenses in the same category", () => {
    const rows = categoryTotals([
      expense({ category: "Prasad", amount: 300 }),
      expense({ category: "Prasad", amount: 250 }),
    ]);

    expect(rows).toEqual([{ category: "Prasad", total: 550, count: 2 }]);
  });

  it("orders categories by spend, not by when they were entered", () => {
    const rows = categoryTotals([
      expense({ category: "Food", amount: 100 }),
      expense({ category: "Mandap", amount: 5000 }),
      expense({ category: "Sound", amount: 900 }),
    ]);

    expect(rows.map((r) => r.category)).toEqual(["Mandap", "Sound", "Food"]);
  });

  it("leaves out categories nobody has spent on", () => {
    const rows = categoryTotals([expense({ category: "Idol", amount: 11000 })]);

    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe("Idol");
  });

  // Postgres numeric comes back as a string over the wire; adding those with
  // `+` would concatenate "300" and "250" into 300250.
  it("adds string amounts as numbers", () => {
    const rows = categoryTotals([
      expense({ category: "Sound", amount: "300" as unknown as number }),
      expense({ category: "Sound", amount: "250" as unknown as number }),
    ]);

    expect(rows[0].total).toBe(550);
  });

  it("keeps the shares summing to the whole ledger", () => {
    const rows = categoryTotals([
      expense({ category: "Food", amount: 400 }),
      expense({ category: "Prasad", amount: 600 }),
    ]);

    expect(rows.reduce((sum, r) => sum + r.total, 0)).toBe(1000);
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(2);
  });
});
