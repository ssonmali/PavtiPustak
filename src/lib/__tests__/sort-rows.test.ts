import { describe, expect, it } from "vitest";
import { DEFAULT_SORT, sortRows, type SortFields } from "@/app/dashboard/sort-rows";

type Row = { date: string; amount: number | string; name: string };

const FIELDS: SortFields<Row> = {
  date: (r) => r.date,
  amount: (r) => r.amount,
  name: (r) => r.name,
};

const rows: Row[] = [
  { date: "2026-09-02", amount: 500, name: "Chitra" },
  { date: "2026-09-05", amount: 90, name: "Anita" },
  { date: "2026-08-30", amount: 2500, name: "Bhalchandra" },
];

const names = (out: Row[]) => out.map((r) => r.name);

describe("sortRows", () => {
  it("defaults to newest first", () => {
    expect(names(sortRows(rows, DEFAULT_SORT, FIELDS))).toEqual([
      "Anita",
      "Chitra",
      "Bhalchandra",
    ]);
  });

  it("sorts oldest first", () => {
    expect(names(sortRows(rows, "date-asc", FIELDS))).toEqual([
      "Bhalchandra",
      "Chitra",
      "Anita",
    ]);
  });

  it("sorts by amount in both directions", () => {
    expect(names(sortRows(rows, "amount-desc", FIELDS))).toEqual([
      "Bhalchandra",
      "Chitra",
      "Anita",
    ]);
    expect(names(sortRows(rows, "amount-asc", FIELDS))).toEqual([
      "Anita",
      "Chitra",
      "Bhalchandra",
    ]);
  });

  // Postgres numeric comes back as a string. Compared as strings, "90" would
  // sort above "2500" because "9" > "2".
  it("compares string amounts as numbers", () => {
    const wire: Row[] = [
      { date: "2026-09-01", amount: "90", name: "Anita" },
      { date: "2026-09-01", amount: "2500", name: "Bhalchandra" },
      { date: "2026-09-01", amount: "500", name: "Chitra" },
    ];
    expect(names(sortRows(wire, "amount-desc", FIELDS))).toEqual([
      "Bhalchandra",
      "Chitra",
      "Anita",
    ]);
  });

  it("sorts names alphabetically", () => {
    expect(names(sortRows(rows, "name-asc", FIELDS))).toEqual([
      "Anita",
      "Bhalchandra",
      "Chitra",
    ]);
  });

  // The caller passes a memoised array that React still holds a reference to.
  it("leaves the input array untouched", () => {
    const input = [...rows];
    sortRows(input, "amount-desc", FIELDS);
    expect(names(input)).toEqual(names(rows));
  });

  // Receipts arrive newest-first by day and then by receipt number; a day with
  // several receipts must keep that order rather than shuffling.
  it("keeps the incoming order for rows that tie", () => {
    const sameDay: Row[] = [
      { date: "2026-09-01", amount: 100, name: "first" },
      { date: "2026-09-01", amount: 100, name: "second" },
      { date: "2026-09-01", amount: 100, name: "third" },
    ];
    expect(names(sortRows(sameDay, "date-desc", FIELDS))).toEqual([
      "first",
      "second",
      "third",
    ]);
  });
});
