import { describe, expect, it } from "vitest";
import {
  dayOf,
  formatAmount,
  formatDate,
  formatDateShort,
  formatDateTime,
  toDateValue,
  utcMidnight,
  whatsappUrl,
} from "@/lib/receipt-utils";
import type { Receipt } from "@/lib/types";

const receipt: Receipt = {
  id: "11111111-1111-1111-1111-111111111111",
  receipt_number: 47,
  donor_name: "सुनील पाटील",
  amount: 501,
  phone_number: "9876543210",
  payment_method: "Cash",
  collection_date: "2026-08-22",
  created_at: "2026-08-22T13:15:00Z",
  updated_at: "2026-08-22T13:15:00Z",
  user_id: "22222222-2222-2222-2222-222222222222",
  created_by_email: "volunteer@mandal.org",
};

describe("date formatting is timezone-independent", () => {
  // These ran differently on the server and the client before, which broke
  // hydration. The values must not depend on the host zone.
  it("formats a date-only column in UTC", () => {
    expect(formatDate("2026-08-22")).toBe("22 Aug 2026");
    expect(formatDateShort("2026-01-01")).toBe("1 Jan");
  });

  it("never shifts the day near midnight IST", () => {
    // 00:30 IST on the 23rd is 19:00 UTC on the 22nd. A naive local parse
    // would report the 22nd for a volunteer in India.
    expect(dayOf("2026-08-22T19:00:00Z")).toBe("2026-08-23");
  });

  it("renders timestamps in the mandal's zone", () => {
    expect(formatDateTime("2026-08-22T13:15:00Z")).toContain("06:45 pm");
  });

  it("round-trips a Date through toDateValue on the local calendar", () => {
    expect(toDateValue(new Date(2026, 7, 22))).toBe("2026-08-22");
    // Single digits must be zero-padded or string comparison breaks.
    expect(toDateValue(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("formatAmount", () => {
  it("uses the Indian digit grouping", () => {
    expect(formatAmount(125000)).toBe("₹1,25,000");
  });

  it("accepts the string numerics supabase-js can return", () => {
    expect(formatAmount("501")).toBe("₹501");
  });
});

describe("utcMidnight", () => {
  it("lands on UTC midnight, not local midnight", () => {
    expect(utcMidnight("2026-08-01").toISOString()).toBe(
      "2026-08-01T00:00:00.000Z",
    );
  });

  it("keeps the day a spreadsheet serial number resolves to", () => {
    // getTime()/86400000 + days-before-unix-epoch is how xlsx serials are
    // derived; a fractional result means the sheet shows the previous day.
    const serial = utcMidnight("2026-08-01").getTime() / 86_400_000 + 25_569;
    expect(serial).toBe(46_235);
  });
});

describe("whatsappUrl", () => {
  it("prefixes the country code and encodes the message", () => {
    const url = whatsappUrl(receipt, "श्री गणेश मंडळ");
    expect(url.startsWith("https://wa.me/919876543210?text=")).toBe(true);
    expect(url).not.toContain(" ");
    expect(decodeURIComponent(url)).toContain("सुनील पाटील");
    expect(decodeURIComponent(url)).toContain("47");
  });
});
