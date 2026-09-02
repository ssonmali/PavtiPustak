import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIMIT,
  applyReceiptQuery,
  MAX_LIMIT,
  clampPage,
  isDefaultQuery,
  orderFor,
  parseReceiptQuery,
  searchFilter,
  toSearchParams,
} from "@/app/dashboard/receipts-query";
import { DEFAULT_SORT, SORT_KEYS } from "@/app/dashboard/sort-rows";

describe("parseReceiptQuery — defaults", () => {
  /**
   * The plain URL has to keep working: /dashboard/receipts with no params is
   * what every existing link and the bottom nav point at.
   */
  it("reads an empty query as the current behaviour", () => {
    const q = parseReceiptQuery({});
    expect(q.sort).toBe(DEFAULT_SORT);
    expect(q.q).toBe("");
    expect(q.status).toBe("all");
    expect(q.period).toEqual({ kind: "all" });
  });
});

describe("parseReceiptQuery — junk never throws", () => {
  /**
   * These params are in the URL bar, so they are user input. A hand-edited or
   * stale link must render the default list, not an error page.
   */
  it("falls back to the default sort", () => {
    expect(parseReceiptQuery({ sort: "garbage" }).sort).toBe(DEFAULT_SORT);
  });

  it("falls back to showing every status", () => {
    expect(parseReceiptQuery({ status: "Cancelled" }).status).toBe("all");
  });

  it("falls back to all time on a non-numeric day count", () => {
    expect(parseReceiptQuery({ days: "abc" }).period).toEqual({ kind: "all" });
  });

  it("falls back to all time on a nonsense date", () => {
    // 31 February round-trips to 2 March, so a string check is not enough.
    expect(parseReceiptQuery({ from: "2026-02-31" }).period).toEqual({
      kind: "all",
    });
  });

  it("takes the first value when a param is repeated", () => {
    // Next hands back string[] for ?sort=a&sort=b.
    expect(parseReceiptQuery({ sort: ["number-asc", "date-asc"] }).sort).toBe(
      "number-asc",
    );
  });
});

describe("parseReceiptQuery — real values", () => {
  it("reads every sort key the UI can produce", () => {
    for (const key of SORT_KEYS) {
      expect(parseReceiptQuery({ sort: key }).sort).toBe(key);
    }
  });

  it("reads a preset period", () => {
    expect(parseReceiptQuery({ days: "7" }).period).toEqual({
      kind: "days",
      days: 7,
    });
  });

  it("reads a custom range", () => {
    expect(
      parseReceiptQuery({ from: "2026-08-01", to: "2026-08-31" }).period,
    ).toEqual({ kind: "custom", from: "2026-08-01", to: "2026-08-31" });
  });

  it("trims the search term", () => {
    expect(parseReceiptQuery({ q: "  ramesh  " }).q).toBe("ramesh");
  });
});

describe("orderFor — every sort is a total order", () => {
  /**
   * The tiebreaker is not cosmetic. Rows sharing a collection_date have no
   * defined order without it, so Postgres may return them differently for
   * page 1 and page 2 — and a receipt then appears twice, or not at all.
   */
  it("breaks ties on receipt_number for every key", () => {
    for (const key of SORT_KEYS) {
      const cols = orderFor(key);
      expect(cols.length).toBeGreaterThan(0);
      expect(cols.at(-1)!.column).toBe("receipt_number");
    }
  });

  it("does not order by the same column twice", () => {
    for (const key of SORT_KEYS) {
      const cols = orderFor(key).map((c) => c.column);
      expect(new Set(cols).size).toBe(cols.length);
    }
  });

  it("maps the reported case: ascending serial order", () => {
    expect(orderFor("number-asc")).toEqual([
      { column: "receipt_number", ascending: true },
    ]);
  });

  it("maps the default to newest first", () => {
    expect(orderFor("date-desc")).toEqual([
      { column: "collection_date", ascending: false },
      { column: "receipt_number", ascending: false },
    ]);
  });

  it("maps amount and name to their columns", () => {
    expect(orderFor("amount-asc")[0]).toEqual({
      column: "amount",
      ascending: true,
    });
    expect(orderFor("name-asc")[0]).toEqual({
      column: "donor_name",
      ascending: true,
    });
  });
});

describe("searchFilter", () => {
  it("is absent for an empty term, so the query is unfiltered", () => {
    expect(searchFilter("")).toBeNull();
    expect(searchFilter("   ")).toBeNull();
  });

  /**
   * Quoted, and that is deliberate rather than incidental: `,` separates
   * clauses inside or(...) and `.` separates a clause's parts, so an unquoted
   * pattern lets a donor's name break out of its own filter. The comma case
   * further down passes because of these quotes.
   */
  it("matches a donor by name", () => {
    expect(searchFilter("ramesh")).toContain('donor_name.ilike."%ramesh%"');
  });

  it("matches a phone number", () => {
    expect(searchFilter("98765")).toContain('phone_number.ilike."%98765%"');
  });

  it("also matches the slip number when the term is a number", () => {
    expect(searchFilter("47")).toContain("receipt_number.eq.47");
  });

  it("does not ask for a slip number when the term is not one", () => {
    expect(searchFilter("ramesh")).not.toContain("receipt_number");
  });

  /**
   * A donor called "100%" is a search for those characters. Unescaped, the %
   * is an ilike wildcard and the term silently matches everything.
   */
  it("escapes ilike wildcards in the term", () => {
    const f = searchFilter("100%")!;
    expect(f).not.toContain("%100%%");
    expect(f).toContain("100\\%");
  });

  it("escapes an underscore, which matches any single character", () => {
    expect(searchFilter("a_b")).toContain("a\\_b");
  });

  /** A comma would end one .or() clause and start another. */
  it("does not let a comma break out of the clause", () => {
    const f = searchFilter("a,b");
    expect(f).not.toMatch(/ilike\.%a%,/);
  });
});

describe("clampPage — fetchReceipts is a public endpoint", () => {
  it("accepts an ordinary page", () => {
    expect(clampPage(50, 50)).toEqual({ offset: 50, limit: 50 });
  });

  it("refuses a negative offset", () => {
    expect(clampPage(-1, 50).offset).toBe(0);
  });

  it("caps an absurd limit rather than asking for the whole table", () => {
    expect(clampPage(0, 1_000_000).limit).toBe(MAX_LIMIT);
  });

  it("falls back on values that are not numbers at all", () => {
    expect(clampPage("nonsense", undefined)).toEqual({
      offset: 0,
      limit: DEFAULT_LIMIT,
    });
  });

  it("refuses a fractional page", () => {
    expect(clampPage(1.5, 10.2)).toEqual({ offset: 1, limit: 10 });
  });
});

/**
 * A recording stand-in for a Supabase query builder. Asserting on the calls is
 * the point here: translating the four controls into order/eq/gte/lte/or IS
 * this function's behaviour, and it is the step where a filter can silently go
 * missing and quietly return the wrong ledger.
 */
function fakeBuilder() {
  const calls: string[] = [];
  const self = {
    calls,
    order(column: string, o: { ascending: boolean }) {
      calls.push(`order:${column}:${o.ascending ? "asc" : "desc"}`);
      return self;
    },
    eq(column: string, value: unknown) {
      calls.push(`eq:${column}:${String(value)}`);
      return self;
    },
    gte(column: string, value: unknown) {
      calls.push(`gte:${column}:${String(value)}`);
      return self;
    },
    lte(column: string, value: unknown) {
      calls.push(`lte:${column}:${String(value)}`);
      return self;
    },
    or(filter: string) {
      calls.push(`or:${filter}`);
      return self;
    },
  };
  return self;
}

describe("applyReceiptQuery", () => {
  it("orders by the sort, with the tiebreaker", () => {
    const b = fakeBuilder();
    applyReceiptQuery(b, parseReceiptQuery({ sort: "number-asc" }));
    expect(b.calls).toEqual(["order:receipt_number:asc"]);
  });

  it("adds nothing at all for the default query", () => {
    const b = fakeBuilder();
    applyReceiptQuery(b, parseReceiptQuery({}));
    // Only ordering: no status, no dates, no search.
    expect(b.calls).toEqual([
      "order:collection_date:desc",
      "order:receipt_number:desc",
    ]);
  });

  it("filters by status only when one is chosen", () => {
    const b = fakeBuilder();
    applyReceiptQuery(b, parseReceiptQuery({ status: "Unpaid" }));
    expect(b.calls).toContain("eq:payment_status:Unpaid");

    const all = fakeBuilder();
    applyReceiptQuery(all, parseReceiptQuery({ status: "all" }));
    expect(all.calls.some((c) => c.startsWith("eq:payment_status"))).toBe(false);
  });

  it("bounds a custom period on both ends", () => {
    const b = fakeBuilder();
    applyReceiptQuery(
      b,
      parseReceiptQuery({ from: "2026-08-01", to: "2026-08-31" }),
    );
    expect(b.calls).toContain("gte:collection_date:2026-08-01");
    expect(b.calls).toContain("lte:collection_date:2026-08-31");
  });

  it("applies the search as one or() clause", () => {
    const b = fakeBuilder();
    applyReceiptQuery(b, parseReceiptQuery({ q: "ramesh" }));
    expect(b.calls.filter((c) => c.startsWith("or:"))).toHaveLength(1);
  });

  it("combines every control at once", () => {
    const b = fakeBuilder();
    applyReceiptQuery(
      b,
      parseReceiptQuery({
        sort: "amount-desc",
        status: "Unpaid",
        q: "ramesh",
        from: "2026-08-01",
      }),
    );
    expect(b.calls).toContain("order:amount:desc");
    expect(b.calls).toContain("eq:payment_status:Unpaid");
    expect(b.calls).toContain("gte:collection_date:2026-08-01");
    expect(b.calls.some((c) => c.startsWith("or:"))).toBe(true);
  });
});

describe("isDefaultQuery — what may be cached for offline use", () => {
  /**
   * The offline copy is replaced by whatever page is on screen, so it may only
   * be written from the unfiltered view. Cache a filtered page and a volunteer
   * who filters to Unpaid and then loses signal is left holding a ledger with
   * only unpaid receipts in it — and no way to tell that is what happened.
   */
  it("is true for the plain view", () => {
    expect(isDefaultQuery(parseReceiptQuery({}))).toBe(true);
  });

  it("is false once anything is narrowed", () => {
    expect(isDefaultQuery(parseReceiptQuery({ status: "Unpaid" }))).toBe(false);
    expect(isDefaultQuery(parseReceiptQuery({ q: "ramesh" }))).toBe(false);
    expect(isDefaultQuery(parseReceiptQuery({ days: "7" }))).toBe(false);
    expect(
      isDefaultQuery(parseReceiptQuery({ from: "2026-08-01" })),
    ).toBe(false);
  });

  /**
   * A sort is not a filter: the same rows come back, so the cache stays a
   * complete copy of the newest page and is safe to write.
   */
  it("is true under a reordering, which returns the same rows", () => {
    expect(isDefaultQuery(parseReceiptQuery({ sort: "number-asc" }))).toBe(true);
  });

  it("agrees with toSearchParams on what a default is", () => {
    for (const sort of SORT_KEYS) {
      const q = parseReceiptQuery({ sort });
      // Sort aside, an empty param set and a default query are the same thing.
      const params = toSearchParams(q);
      delete params.sort;
      expect(isDefaultQuery(q)).toBe(Object.keys(params).length === 0);
    }
  });
});

describe("toSearchParams — the inverse of parsing", () => {
  /**
   * The controls write the URL and the server reads it back, so a query that
   * survives a round trip is the whole contract between them. If these ever
   * disagree, a control would appear to do nothing: the URL changes, the
   * server parses something else, the list comes back the same.
   */
  it("round-trips every sort key", () => {
    for (const sort of SORT_KEYS) {
      const q = parseReceiptQuery({ sort });
      expect(parseReceiptQuery(toSearchParams(q))).toEqual(q);
    }
  });

  it("round-trips a fully loaded query", () => {
    const q = parseReceiptQuery({
      sort: "amount-desc",
      status: "Unpaid",
      q: "ramesh",
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(parseReceiptQuery(toSearchParams(q))).toEqual(q);
  });

  it("round-trips a preset period", () => {
    const q = parseReceiptQuery({ days: "7" });
    expect(parseReceiptQuery(toSearchParams(q))).toEqual(q);
  });

  /** A clean URL for the default view, not ?sort=date-desc&status=all. */
  it("omits everything that is a default", () => {
    expect(toSearchParams(parseReceiptQuery({}))).toEqual({});
  });

  it("omits an empty search rather than leaving ?q=", () => {
    const q = parseReceiptQuery({ sort: "name-asc", q: "" });
    expect(toSearchParams(q)).toEqual({ sort: "name-asc" });
  });
})
