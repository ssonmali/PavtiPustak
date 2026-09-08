/**
 * The geometry of a fixed crop frame with a pannable, zoomable image behind it.
 *
 * The frame never moves or resizes — the image moves under it. So every
 * question here is "which rectangle of the source pixels is currently showing
 * through the hole", and the answer has to hold for any zoom and any pan, or
 * the saved crop is not the one the volunteer framed.
 *
 * Pure, and tested, because the failure is invisible: an off-by-one in the
 * clamp shows as a hairline of empty background down one edge of a wallpaper,
 * which nobody reports and everybody sees.
 */

export type Size = { width: number; height: number };

/** Where the image sits behind the frame, in frame pixels. */
export type Pan = { x: number; y: number };

/**
 * The scale at which the image exactly covers the frame — no gaps, one
 * dimension overflowing. Zoom 1 means this, so zoom is always "how much more
 * than the minimum", and the minimum is never a state that shows background.
 */
export function coverScale(image: Size, frame: Size): number {
  return Math.max(frame.width / image.width, frame.height / image.height);
}

/**
 * Pan, clamped so the image still covers the frame at this zoom.
 *
 * The allowed range is negative: x = 0 puts the image's left edge at the
 * frame's left edge, and the image is wider than the frame, so it may only
 * move left. Where a dimension does not overflow at all the range collapses to
 * a single point, which is why min is compared against 0 rather than assumed
 * to be below it — at zoom 1 exactly one axis has slack and the other has
 * none, and letting that one drift is the hairline gap.
 */
export function clampPan(pan: Pan, image: Size, frame: Size, zoom: number): Pan {
  const scale = coverScale(image, frame) * zoom;
  const minX = Math.min(0, frame.width - image.width * scale);
  const minY = Math.min(0, frame.height - image.height * scale);
  return {
    x: Math.min(0, Math.max(minX, pan.x)),
    y: Math.min(0, Math.max(minY, pan.y)),
  };
}

/** The rectangle of source pixels showing through the frame. */
export type SourceRect = { x: number; y: number; width: number; height: number };

/**
 * The source rectangle to draw from, for a given zoom and pan.
 *
 * Clamps the pan itself rather than trusting the caller: this is what the save
 * path uses, and a stale pan left over from a previous zoom would otherwise be
 * written into the file.
 */
export function sourceRect(
  image: Size,
  frame: Size,
  zoom: number,
  pan: Pan,
): SourceRect {
  const scale = coverScale(image, frame) * zoom;
  const { x, y } = clampPan(pan, image, frame, zoom);
  return {
    x: -x / scale,
    y: -y / scale,
    width: frame.width / scale,
    height: frame.height / scale,
  };
}

/**
 * Keep the same point of the image under the centre of the frame when zooming.
 *
 * Without this a zoom pulls toward the image's top-left corner, so framing a
 * face means zoom, drag back, zoom, drag back. The pan is corrected by the
 * change in displayed size about the frame's midpoint.
 */
export function panForZoom(
  pan: Pan,
  image: Size,
  frame: Size,
  fromZoom: number,
  toZoom: number,
): Pan {
  const base = coverScale(image, frame);
  const ratio = (base * toZoom) / (base * fromZoom);
  return clampPan(
    {
      x: frame.width / 2 - (frame.width / 2 - pan.x) * ratio,
      y: frame.height / 2 - (frame.height / 2 - pan.y) * ratio,
    },
    image,
    frame,
    toZoom,
  );
}
