import { describe, expect, it } from "vitest";
import { coverRect, wrapText } from "@/lib/receipt-image";

describe("coverRect", () => {
  // The idol photo is tall and portrait; the share image is 4:5. Getting this
  // wrong crops the face out or squashes it.
  it("trims top and bottom of a source taller than the box", () => {
    const r = coverRect(720, 1280, 1080, 1350);
    expect(r.sw).toBe(720);
    expect(r.sh).toBeCloseTo(900, 0);
    expect(r.sx).toBe(0);
    // Evenly, so the middle of the photo stays the middle of the image.
    expect(r.sy).toBeCloseTo((1280 - 900) / 2, 0);
  });

  it("trims the sides of a source wider than the box", () => {
    const r = coverRect(2000, 1000, 1080, 1350);
    expect(r.sh).toBe(1000);
    expect(r.sw).toBeCloseTo(800, 0);
    expect(r.sy).toBe(0);
    expect(r.sx).toBeCloseTo((2000 - 800) / 2, 0);
  });

  it("leaves a source of matching ratio uncropped", () => {
    const r = coverRect(1080, 1350, 1080, 1350);
    expect(r).toEqual({ sx: 0, sy: 0, sw: 1080, sh: 1350 });
  });

  it("never returns a source rectangle larger than the source", () => {
    for (const [w, h] of [[100, 4000], [4000, 100], [500, 500]]) {
      const r = coverRect(w, h, 1080, 1350);
      expect(r.sw).toBeLessThanOrEqual(w);
      expect(r.sh).toBeLessThanOrEqual(h);
      expect(r.sx).toBeGreaterThanOrEqual(0);
      expect(r.sy).toBeGreaterThanOrEqual(0);
    }
  });

  it("survives a zero-sized image rather than dividing by zero", () => {
    expect(coverRect(0, 0, 1080, 1350)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 });
  });
});

describe("wrapText", () => {
  // 10px per character, so the arithmetic is checkable by eye.
  const measure = (t: string) => t.length * 10;

  it("keeps a line that fits on one line", () => {
    expect(wrapText(measure, "Shri Ganesh", 200)).toEqual(["Shri Ganesh"]);
  });

  it("breaks a long name across lines", () => {
    expect(wrapText(measure, "Shri Ganesh Mitra Mandal", 150)).toEqual([
      "Shri Ganesh",
      "Mitra Mandal",
    ]);
  });

  it("returns nothing for empty or blank text", () => {
    expect(wrapText(measure, "", 200)).toEqual([]);
    expect(wrapText(measure, "   ", 200)).toEqual([]);
  });

  // A word longer than the box still has to be emitted, or it vanishes.
  it("keeps a word that cannot fit rather than dropping it", () => {
    expect(wrapText(measure, "Dalvinagar", 50)).toEqual(["Dalvinagar"]);
  });
});
