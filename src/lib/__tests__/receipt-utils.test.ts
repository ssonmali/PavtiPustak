import { describe, expect, it } from "vitest";
import {
  dayOf,
  displayName,
  formatAmount,
  formatDate,
  formatDateShort,
  formatDateTime,
  pledgeReminderUrl,
  toDateValue,
  utcMidnight,
  volunteerName,
  whatsappUrl,
} from "@/lib/receipt-utils";
import type { Receipt } from "@/lib/types";

const receipt: Receipt = {
  id: "11111111-1111-1111-1111-111111111111",
  receipt_number: 47,
  donor_name_mr: null,
  paid_amount: null,
  donor_name: "सुनील पाटील",
  amount: 501,
  phone_number: "9876543210",
  payment_method: "Cash",
  collection_date: "2026-08-22",
  created_at: "2026-08-22T13:15:00Z",
  updated_at: "2026-08-22T13:15:00Z",
  user_id: "22222222-2222-2222-2222-222222222222",
  created_by_email: "volunteer@mandal.org",
  payment_status: "Paid",
  due_on: null,
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

describe("volunteerName", () => {
  it("reads a dotted address as a name", () => {
    expect(volunteerName("sanket.sonmali@smartdings.com")).toBe(
      "Sanket Sonmali",
    );
  });

  it("splits on underscores and hyphens too", () => {
    expect(volunteerName("anita_deshmukh@gmail.com")).toBe("Anita Deshmukh");
    expect(volunteerName("ram-joshi@gmail.com")).toBe("Ram Joshi");
  });

  it("normalises shouty addresses", () => {
    expect(volunteerName("MANDAL.TREASURER@gmail.com")).toBe(
      "Mandal Treasurer",
    );
  });

  it("drops a +tag, which is routing rather than a name", () => {
    expect(volunteerName("sanket.sonmali+mandal@gmail.com")).toBe(
      "Sanket Sonmali",
    );
  });

  it("leaves an address that is not name-shaped recognisable", () => {
    expect(volunteerName("treasurer@gmail.com")).toBe("Treasurer");
  });

  it("separates a digit run from the word beside it", () => {
    expect(volunteerName("ganesh123@gmail.com")).toBe("Ganesh 123");
    expect(volunteerName("2ganesh@gmail.com")).toBe("2 Ganesh");
    expect(volunteerName("ram.joshi2@gmail.com")).toBe("Ram Joshi 2");
  });

  it("returns null for a missing email so callers can fall back", () => {
    expect(volunteerName(null)).toBeNull();
    expect(volunteerName(undefined)).toBeNull();
  });

  it("never returns an empty string", () => {
    expect(volunteerName("@gmail.com")).toBe("@gmail.com");
  });
});

describe("displayName", () => {
  const names = { "ganesh123@gmail.com": "Ganesh Kulkarni" };

  it("prefers the name a volunteer set", () => {
    expect(displayName("ganesh123@gmail.com", names)).toBe("Ganesh Kulkarni");
  });

  it("matches the map case-insensitively", () => {
    expect(displayName("Ganesh123@Gmail.com", names)).toBe("Ganesh Kulkarni");
  });

  it("falls back to the derived name when none is set", () => {
    expect(displayName("ram.joshi@gmail.com", names)).toBe("Ram Joshi");
  });

  it("works with no map at all", () => {
    expect(displayName("ram.joshi@gmail.com")).toBe("Ram Joshi");
  });

  it("stays null for a missing email", () => {
    expect(displayName(null, names)).toBeNull();
  });
});

describe("pledgeReminderUrl", () => {
  const pledge: Receipt = {
    ...receipt,
    payment_status: "Unpaid",
    due_on: "2026-09-01",
  };

  it("does not quote a receipt number for money not received", () => {
    const text = decodeURIComponent(pledgeReminderUrl(pledge, "श्री गणेश मित्र मंडळ"));
    expect(text).not.toContain(String(pledge.receipt_number));
    expect(text).not.toContain("आभार");
  });

  it("names the expected date and the amount", () => {
    const text = decodeURIComponent(pledgeReminderUrl(pledge, "श्री गणेश मित्र मंडळ"));
    expect(text).toContain("₹501");
    // Against the formatter, not a literal: ICU renders September as "Sept"
    // in en-IN, and that is not what this test is about.
    expect(text).toContain(formatDate("2026-09-01"));
  });

  it("still addresses the right number", () => {
    expect(
      pledgeReminderUrl(pledge, "M").startsWith("https://wa.me/919876543210?"),
    ).toBe(true);
  });
});

describe("whatsappUrl", () => {
  it("prefixes the country code and encodes the message", () => {
    const url = whatsappUrl(receipt, "श्री गणेश मित्र मंडळ");
    expect(url.startsWith("https://wa.me/919876543210?text=")).toBe(true);
    expect(url).not.toContain(" ");
    expect(decodeURIComponent(url)).toContain("सुनील पाटील");
    expect(decodeURIComponent(url)).toContain("47");
  });
});
