import { describe, expect, it } from "vitest";
import { toDevanagariName } from "@/lib/devanagari-name";
import { marathiDonor } from "@/lib/receipt-utils";

describe("toDevanagariName", () => {
  it("leaves a name already in Devanagari exactly as typed", () => {
    // The volunteer's own spelling always beats this file's guess.
    expect(toDevanagariName("रमेश पाटील")).toBe("रमेश पाटील");
    expect(toDevanagariName("सौ. वैशाली कुलकर्णी")).toBe("सौ. वैशाली कुलकर्णी");
  });

  it("renders known names exactly", () => {
    // The retroflex letters here are the whole reason KNOWN exists: nothing in
    // "Patil" or "Kulkarni" tells you they need ट/ळ and ण/ी.
    const cases: [string, string][] = [
      ["Ramesh Patil", "रमेश पाटील"],
      ["Sanket Sonmali", "संकेत सोनमाळी"],
      ["Ganesh Kulkarni", "गणेश कुलकर्णी"],
      ["Prashant Deshpande", "प्रशांत देशपांडे"],
      ["Shubham Shinde", "शुभम शिंदे"],
      ["Mangesh Jadhav", "मंगेश जाधव"],
      ["Sunil Bhosale", "सुनील भोसले"],
      ["Vitthal More", "विठ्ठल मोरे"],
      ["Vaishali Kamble", "वैशाली कांबळे"],
    ];
    for (const [input, want] of cases) {
      expect(toDevanagariName(input), input).toBe(want);
    }
  });

  it("is case-insensitive and keeps honorifics", () => {
    expect(toDevanagariName("SHRI GANESH")).toBe("श्री गणेश");
    expect(toDevanagariName("shri ganesh")).toBe("श्री गणेश");
    expect(toDevanagariName("Smt. Asha Joshi")).toBe("सौ. आशा जोशी");
  });

  it("nasalises n and m before a consonant rather than clustering", () => {
    // शिन्दे would be wrong, and is what off-the-shelf schemes produce.
    expect(toDevanagariName("Shinde")).toBe("शिंदे");
    expect(toDevanagariName("Sanket")).toBe("संकेत");
  });

  it("never ends a name in an explicit halant", () => {
    // रमेश्, not रमेश, is the giveaway of a naive transliteration.
    for (const n of ["Nikhil", "Bhalerao", "Wadekar", "Ombase", "Kurhade"]) {
      expect(toDevanagariName(n)).not.toMatch(/्$/);
    }
  });

  it("falls back to rules for an unknown name without crashing", () => {
    const out = toDevanagariName("Zxqv");
    expect(out).toBeTruthy();
    expect(out).toMatch(/[ऀ-ॿ]/);
  });

  it("preserves spacing, punctuation and empty input", () => {
    expect(toDevanagariName("")).toBe("");
    expect(toDevanagariName("  ")).toBe("  ");
    // Two spaces between the words must survive, or the image line shifts.
    expect(toDevanagariName("Ramesh  Patil")).toBe("रमेश  पाटील");
    expect(toDevanagariName("Patil, Ramesh")).toBe("पाटील, रमेश");
  });

  it("handles a mixed-script name by leaving it alone", () => {
    // Half-typed in Marathi is still the volunteer's intent, not ours.
    expect(toDevanagariName("रमेश Patil")).toBe("रमेश Patil");
  });
});

describe("marathiDonor", () => {
  const base = { donor_name: "Ramesh Patil" };

  it("prefers a spelling the volunteer corrected", () => {
    // The whole point of storing it: the guess must never win over a person.
    expect(marathiDonor({ ...base, donor_name_mr: "रमेश पाटिल" })).toBe(
      "रमेश पाटिल",
    );
  });

  it("falls back to transliterating when none was stored", () => {
    expect(marathiDonor({ ...base, donor_name_mr: null })).toBe("रमेश पाटील");
  });

  it("treats a blank stored value as absent", () => {
    // An empty field must not blank the name on the receipt.
    expect(marathiDonor({ ...base, donor_name_mr: "   " })).toBe("रमेश पाटील");
    expect(marathiDonor({ ...base, donor_name_mr: "" })).toBe("रमेश पाटील");
  });
});
