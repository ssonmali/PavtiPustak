"use client";

import * as React from "react";
import { ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import {
  clampPan,
  coverScale,
  panForZoom,
  sourceRect,
  type Pan,
  type Size,
} from "@/lib/crop-box";
import { clearWallpaper, getWallpaper, putWallpaper } from "@/lib/offline/db";
import {
  WALLPAPER_CHANGED,
  WALLPAPER_SIZES,
} from "@/components/custom-background";

/** The crop each form factor needs. See the component docblock. */
const TARGETS: Record<
  "portrait" | "landscape",
  { ratio: number; labelKey: MessageKey }
> = {
  portrait: { ratio: 9 / 16, labelKey: "wallpaper.phoneStep" },
  landscape: { ratio: 16 / 9, labelKey: "wallpaper.deskStep" },
};

/** Which one this screen is, right now. */
function currentTarget(): "portrait" | "landscape" {
  return window.matchMedia("(orientation: portrait)").matches
    ? "portrait"
    : "landscape";
}

/** The on-screen frame for a ratio: fixed size, so the crop cannot be wrong. */
function frameFor(ratio: number) {
  return ratio < 1
    ? { width: Math.round(FRAME_MAX * ratio), height: FRAME_MAX }
    : { width: FRAME_MAX, height: Math.round(FRAME_MAX / ratio) };
}

/** Widest the crop frame may be drawn on screen, in CSS pixels. */
const FRAME_MAX = 280;

/**
 * Pick a photo for the Devasthan background and crop it, once.
 *
 * ONE CROP, FOR THIS DEVICE: a phone's hole is ~9:16 and a desktop's ~16:9,
 * and globals.css keeps a default for each, so a volunteer frames only the
 * shape they are looking at. The other orientation keeps its default photo
 * rather than a guessed crop — the defaults are two different photographs
 * framed for their own shapes, not two crops of one.
 *
 * THE FRAME IS FIXED; the photo pans and zooms under it. So the saved aspect
 * ratio is a property of the frame and cannot be wrong.
 *
 * PER DEVICE. Nothing is uploaded or shared: IndexedDB on this device,
 * surviving sign-out (see STORE_WALLPAPER) and lost if site data is cleared.
 * That contract is stated in the UI, not only here.
 */
export function BackgroundCropper({
  /**
   * Called once the crop is written, or the photo removed. Optional: the
   * settings page keeps its panel open, while the header dialog closes itself
   * rather than hiding the thing the volunteer came to see.
   */
  onDone,
  /** The dialog supplies its own heading, so the panel drops its own. */
  hideHeading = false,
}: {
  onDone?: () => void;
  hideHeading?: boolean;
} = {}) {
  const { t } = useI18n();
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  // Read at pick time, not on mount, so a tablet rotated before choosing a
  // photo crops for the shape it is now.
  const [target, setTarget] = React.useState<"portrait" | "landscape">(
    "portrait",
  );
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState<Pan>({ x: 0, y: 0 });
  const [saving, setSaving] = React.useState(false);
  const [hasCustom, setHasCustom] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  /** The blob URL backing both the decode and the on-screen preview. */
  const objectUrl = React.useRef<string | null>(null);

  const release = React.useCallback(() => {
    if (!objectUrl.current) return;
    URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  }, []);

  // Cancelling, saving and picking again all release explicitly; this covers
  // the volunteer who closes the dialog mid-crop, which would otherwise leave
  // a full-resolution photo held in memory.
  React.useEffect(() => release, [release]);

  // This device's crop, not the other one: the button has to say "Change
  // photo" only when there is something here to change.
  React.useEffect(() => {
    void getWallpaper(currentTarget()).then((b) => setHasCustom(Boolean(b)));
  }, []);

  const current = TARGETS[target];
  const frame: Size = React.useMemo(
    () => frameFor(current.ratio),
    [current.ratio],
  );

  /** Centres the photo in the frame at minimum zoom. */
  const reset = React.useCallback(
    (img: HTMLImageElement, f: Size) => {
      const natural = { width: img.naturalWidth, height: img.naturalHeight };
      const scale = coverScale(natural, f);
      setZoom(1);
      setPan(
        clampPan(
          {
            x: (f.width - natural.width * scale) / 2,
            y: (f.height - natural.height * scale) / 2,
          },
          natural,
          f,
          1,
        ),
      );
    },
    [],
  );

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so choosing the same file twice in a row still fires a change.
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("wallpaper.notAnImage"));
      return;
    }

    /*
     * The URL has to outlive the decode. Revoking it in onload is tempting —
     * the Image holds the decoded bitmap and drawImage works from it — but the
     * PREVIEW is a second <img> on the same URL, and a revoked URL cannot
     * load. That gave an invisible photo while the saved file came out
     * correct, so nothing in the output said the input was broken.
     *
     * Released when the photo is replaced, cancelled, saved, or unmounted;
     * release() is the only place that happens.
     */
    release();
    const url = URL.createObjectURL(file);
    objectUrl.current = url;
    const img = new Image();
    img.onload = () => {
      // Decided here, not on mount: a tablet rotated between opening this and
      // choosing a photo should crop for the shape it is now.
      const next = currentTarget();
      setTarget(next);
      setImage(img);
      reset(img, frameFor(TARGETS[next].ratio));
    };
    img.onerror = () => {
      release();
      toast.error(t("wallpaper.unreadable"));
    };
    img.src = url;
  }

  const natural: Size | null = image
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : null;

  /* --- panning ------------------------------------------------------ */

  const drag = React.useRef<{ id: number; x: number; y: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (!natural) return;
    // Captured, so a finger that leaves the frame mid-drag keeps dragging
    // rather than dropping the photo where it happened to be.
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !natural) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    setPan((p) => clampPan({ x: p.x + dx, y: p.y + dy }, natural, frame, zoom));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }

  function onZoom(next: number) {
    if (!natural) return;
    setPan((p) => panForZoom(p, natural, frame, zoom, next));
    setZoom(next);
  }

  /* --- saving ------------------------------------------------------- */

  async function onConfirm() {
    if (!image || !natural) return;
    setSaving(true);
    try {
      const out = WALLPAPER_SIZES[target];
      const canvas = document.createElement("canvas");
      canvas.width = out.width;
      canvas.height = out.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");

      // The rectangle showing through the frame, mapped straight onto the
      // output. sourceRect re-clamps the pan, so a pan left over from a
      // higher zoom cannot write a gap into the file.
      const r = sourceRect(natural, frame, zoom, pan);
      ctx.drawImage(
        image,
        r.x,
        r.y,
        r.width,
        r.height,
        0,
        0,
        out.width,
        out.height,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.82),
      );
      if (!blob) throw new Error("encode failed");

      // One crop, for this device. The other orientation is deliberately left
      // on its default photo — see TARGETS.
      await putWallpaper(target, blob);
      window.dispatchEvent(new Event(WALLPAPER_CHANGED));
      release();
      setImage(null);
      setHasCustom(true);
      toast.success(t("wallpaper.saved"));
      onDone?.();
    } catch {
      toast.error(t("wallpaper.failed"));
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    await clearWallpaper();
    window.dispatchEvent(new Event(WALLPAPER_CHANGED));
    release();
    setHasCustom(false);
    setImage(null);
    toast.success(t("wallpaper.removed"));
    onDone?.();
  }

  const scale = natural ? coverScale(natural, frame) * zoom : 1;

  return (
    <div className="flex flex-col gap-3">
      {hideHeading ? null : (
        <div>
          <p className="text-sm font-medium">{t("wallpaper.title")}</p>
          {/* The contract, stated in the UI and not only in the code. A
              volunteer who takes this for the mandal's shared background would
              be surprised twice: once when nobody else sees it, and again when
              clearing their browser loses it. */}
          <p className="text-xs text-muted-foreground">
            {t("wallpaper.deviceOnly")}
          </p>
        </div>
      )}

      {image && natural ? (
        <>
          <p className="text-xs font-medium">{t(current.labelKey)}</p>
          <div
            className="relative touch-none overflow-hidden rounded-lg ring-1 ring-foreground/15 select-none"
            style={{ width: frame.width, height: frame.height }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt=""
              draggable={false}
              /* max-w-none is load-bearing: Tailwind's preflight sets
                 `img { max-width: 100% }`, which capped a declared 1200px to
                 the frame's 158px while the inline height stayed at 800 — so
                 the crop framed was not the crop saved. Measured 55x280
                 before, 420x280 after. */
              className="absolute max-w-none origin-top-left"
              style={{
                width: natural.width,
                height: natural.height,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3"
            >
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="border border-white/15" />
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t("wallpaper.zoom")}</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => onZoom(Number(e.target.value))}
              className="min-w-0 flex-1"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onConfirm} disabled={saving}>
              {t("wallpaper.save")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="glass-pill"
              onClick={() => reset(image, frame)}
              disabled={saving}
            >
              <RotateCcw /> {t("wallpaper.recentre")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                release();
                setImage(null);
              }}
              disabled={saving}
            >
              {t("wallpaper.cancel")}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onPick}
          />
          <Button
            size="sm"
            variant="outline"
            className="glass-pill"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus />
            {hasCustom ? t("wallpaper.change") : t("wallpaper.choose")}
          </Button>
          {hasCustom ? (
            <Button size="sm" variant="ghost" onClick={onRemove}>
              <Trash2 /> {t("wallpaper.reset")}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
