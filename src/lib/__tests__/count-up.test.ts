import { describe, expect, it } from "vitest";
import { durationFor, easeOutCubic, valueAt } from "@/lib/count-up";

describe("valueAt", () => {
  it("starts exactly at `from` and lands exactly on `to`", () => {
    // The landing is the whole point: a total that settles one rupee out
    // because the easing was rounded is a wrong number on screen.
    expect(valueAt(1000, 2000, 0, 600)).toBe(1000);
    expect(valueAt(1000, 2000, 600, 600)).toBe(2000);
    expect(valueAt(1000, 2000, 999, 600)).toBe(2000);
    expect(valueAt(1000, 2000, -50, 600)).toBe(1000);
  });

  it("never ticks backwards on the way up", () => {
    let previous = -Infinity;
    for (let ms = 0; ms <= 600; ms += 10) {
      const v = valueAt(0, 12345, ms, 600);
      expect(v).toBeGreaterThanOrEqual(previous);
      previous = v;
    }
  });

  it("counts down as readily as up", () => {
    // Deleting a receipt lowers a total, and the figure must move rather than
    // jump — the same movement is what says "this changed".
    expect(valueAt(2000, 1000, 300, 600)).toBeLessThan(2000);
    expect(valueAt(2000, 1000, 300, 600)).toBeGreaterThan(1000);
    expect(valueAt(2000, 1000, 600, 600)).toBe(1000);
  });

  it("returns whole rupees", () => {
    for (let ms = 0; ms <= 600; ms += 37) {
      expect(Number.isInteger(valueAt(0, 9999, ms, 600))).toBe(true);
    }
  });

  it("treats a zero duration as already finished", () => {
    // Guards the reduced-motion and first-paint paths, which both ask for the
    // final value with no time to get there.
    expect(valueAt(0, 500, 0, 0)).toBe(500);
  });
});

describe("durationFor", () => {
  it("is zero when nothing changed", () => {
    // The component uses this to skip the animation entirely, so a poll that
    // returns the same total does not re-run a count-up on every tick.
    expect(durationFor(5000, 5000)).toBe(0);
  });

  it("gives a small relative change a short sweep", () => {
    // One ₹101 receipt on a ₹40,000 day.
    expect(durationFor(40000, 40101)).toBeLessThan(250);
  });

  it("gives a figure appearing from nothing the full sweep", () => {
    expect(durationFor(0, 40000)).toBe(900);
  });

  it("stays within its bounds whatever the numbers", () => {
    for (const [a, b] of [[0, 1], [1, 1000000], [999999, 3], [7, 9]]) {
      const d = durationFor(a, b);
      expect(d).toBeGreaterThanOrEqual(200);
      expect(d).toBeLessThanOrEqual(900);
    }
  });
});

describe("easeOutCubic", () => {
  it("is pinned at both ends and decelerates", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    // Past halfway by the time a third of the duration has run.
    expect(easeOutCubic(0.33)).toBeGreaterThan(0.5);
  });
});
