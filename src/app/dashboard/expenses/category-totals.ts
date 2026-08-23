import type { Expense, ExpenseCategory } from "@/lib/types";

export type CategoryTotal = {
  category: ExpenseCategory;
  total: number;
  count: number;
};

/**
 * Totals per category, biggest first. Categories nobody has spent on are left
 * out — a row of zeroes says nothing about where the money went.
 *
 * Kept apart from the card that draws it so it can be tested without a DOM.
 */
export function categoryTotals(expenses: Expense[]): CategoryTotal[] {
  const byCategory = new Map<ExpenseCategory, CategoryTotal>();

  for (const expense of expenses) {
    const category = expense.category as ExpenseCategory;
    const row = byCategory.get(category) ?? { category, total: 0, count: 0 };
    row.total += Number(expense.amount);
    row.count += 1;
    byCategory.set(category, row);
  }

  return [...byCategory.values()].sort((a, b) => b.total - a.total);
}
