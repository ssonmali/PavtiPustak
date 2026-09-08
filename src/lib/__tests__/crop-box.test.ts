import { describe, expect, it } from "vitest";
import {
  clampPan,
  coverScale,
  panForZoom,
  sourceRect,
} from "@/lib/crop-box";

/** A 4000x3000 photo (4:3) into a 9:16 portrait frame. */
const photo = { width: 4000, height: 3000 };
const portrait = { width: 360, height: 640 };
/** And into a 16:9 landscape frame. */
const landscape = { width: 640, height: 360 };

describe("coverScale", () => {
  it("fills the frame on the tighter axis", () => {
    // Portrait: 640/3000 = .213 beats 360/4000 = .09, so height governs.
    expect(coverScale(photo, portrait)).toBeCloseTo(640 / 3000);
    // Landscape: 640/4000 = .16 beats 360/3000 = .12, so width governs — a
    // 4:3 photo is narrower than 16:9, which is the whole reason the desktop
    // crop needs its own pass rather than reusing the portrait one.
    expect(coverScale(photo, landscape)).toBeCloseTo(640 / 4000);
  });

  it("leaves no gap on either axis", () => {
    for (const frame of [portrait, landscape]) {
      const s = coverScale(photo, frame);
      expect(photo.width * s).toBeGreaterThanOrEqual(frame.width - 1e-9);
      expect(photo.height * s).toBeGreaterThanOrEqual(frame.height - 1e-9);
    }
  });
});

describe("clampPan", () => {
  it("never lets the image pull away from an edge", () => {
    // The specific bug this guards: a wallpaper with a hairline of empty
    // background down one side, which nobody reports and everybody sees.
    const far = clampPan({ x: 5000, y: 5000 }, photo, portrait, 1);
    expect(far).toEqual({ x: 0, y: 0 });

    const s = coverScale(photo, portrait);
    const minX = portrait.width - photo.width * s;
    const beyond = clampPan({ x: minX - 500, y: -500 }, photo, portrait, 1);
    expect(beyond.x).toBeCloseTo(minX);
  });

  it("pins an axis with no slack to zero", () => {
    // At zoom 1 exactly one axis overflows. The other has no room at all, and
    // letting it drift by even a pixel is the gap above.
    const pinned = clampPan({ x: -10, y: -10 }, photo, portrait, 1);
    expect(pinned.y).toBe(0);
    expect(pinned.x).toBeLessThan(0);
  });
});

describe("sourceRect", () => {
  it("takes a full-height centre slice at zoom 1", () => {
    const s = coverScale(photo, portrait);
    const centred = clampPan(
      { x: (portrait.width - photo.width * s) / 2, y: 0 },
      photo,
      portrait,
      1,
    );
    const r = sourceRect(photo, portrait, 1, centred);
    expect(r.y).toBeCloseTo(0);
    expect(r.height).toBeCloseTo(photo.height);
    // 9:16 out of 4:3 keeps a narrow column.
    expect(r.width).toBeCloseTo(photo.height * (9 / 16));
  });

  it("halves the visible area when zoomed 2x", () => {
    const a = sourceRect(photo, portrait, 1, { x: 0, y: 0 });
    const b = sourceRect(photo, portrait, 2, { x: 0, y: 0 });
    expect(b.width).toBeCloseTo(a.width / 2);
    expect(b.height).toBeCloseTo(a.height / 2);
  });

  it("stays inside the source image at every zoom and pan", () => {
    for (const zoom of [1, 1.3, 2, 3.7]) {
      for (const pan of [{ x: 0, y: 0 }, { x: -9999, y: -9999 }, { x: 9999, y: 9999 }]) {
        const r = sourceRect(photo, portrait, zoom, pan);
        expect(r.x).toBeGreaterThanOrEqual(-1e-6);
        expect(r.y).toBeGreaterThanOrEqual(-1e-6);
        expect(r.x + r.width).toBeLessThanOrEqual(photo.width + 1e-6);
        expect(r.y + r.height).toBeLessThanOrEqual(photo.height + 1e-6);
      }
    }
  });

  it("clamps a pan left over from a lower zoom", () => {
    // The save path calls this with whatever pan is in state. A pan that was
    // legal at zoom 3 is off the edge at zoom 1, and writing it would put a
    // gap in the saved file rather than on screen.
    const r = sourceRect(photo, portrait, 1, { x: -3000, y: -2000 });
    expect(r.x + r.width).toBeLessThanOrEqual(photo.width + 1e-6);
    expect(r.y).toBeCloseTo(0);
  });
});

describe("panForZoom", () => {
  it("holds the frame's centre point on the same pixel", () => {
    const frame = portrait;
    const before = sourceRect(photo, frame, 1.5, { x: -100, y: -50 });
    const centreBefore = {
      x: before.x + before.width / 2,
      y: before.y + before.height / 2,
    };
    const pan = panForZoom({ x: -100, y: -50 }, photo, frame, 1.5, 2.5);
    const after = sourceRect(photo, frame, 2.5, pan);
    expect(after.x + after.width / 2).toBeCloseTo(centreBefore.x, 4);
    expect(after.y + after.height / 2).toBeCloseTo(centreBefore.y, 4);
  });

  it("returns a pan that is already legal", () => {
    const pan = panForZoom({ x: 0, y: 0 }, photo, portrait, 3, 1);
    expect(pan).toEqual(clampPan(pan, photo, portrait, 1));
  });
});
