/**
 * Renders a receipt as a shareable PNG.
 *
 * Drawn on a canvas rather than rasterised from the DOM: `foreignObject`
 * screenshotting has to inline every stylesheet and font to work, and silently
 * drops what it cannot reach. Canvas text goes through the browser's own
 * shaper, so Devanagari comes out correct, and the output is a fixed size for
 * sharing instead of whatever the phone's viewport happened to be.
 */

/** Portrait 4:5 — the largest shape WhatsApp shows without cropping a preview. */
export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1350;

export type ReceiptImageData = {
  mandalName: string;
  address?: string | null;
  title: string;
  donorLabel: string;
  donorName: string;
  amountLabel: string;
  amount: string;
  rows: { label: string; value: string }[];
  thanks: string;
  footer?: string | null;
  president?: string | null;
  vicePresident?: string | null;
};

/**
 * Source rectangle that fills a box without distorting, cropping the overflow
 * evenly — the equivalent of `object-fit: cover`.
 */
export function coverRect(
  sourceWidth: number,
  sourceHeight: number,
  boxWidth: number,
  boxHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight };
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const boxRatio = boxWidth / boxHeight;

  if (sourceRatio > boxRatio) {
    // Source is wider than the box: keep full height, trim the sides.
    const sw = sourceHeight * boxRatio;
    return { sx: (sourceWidth - sw) / 2, sy: 0, sw, sh: sourceHeight };
  }
  // Taller than the box: keep full width, trim top and bottom equally.
  const sh = sourceWidth / boxRatio;
  return { sx: 0, sy: (sourceHeight - sh) / 2, sw: sourceWidth, sh };
}

/** Breaks a string onto as many lines as it needs to fit `maxWidth`. */
export function wrapText(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let line = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

const SANS = '"Geist", system-ui, sans-serif';
const DISPLAY = '"Tiro Devanagari Marathi", serif';

/** Draws the receipt and hands back a PNG blob. */
export async function drawReceiptImage(
  data: ReceiptImageData,
  backgroundUrl: string | null,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");

  // Webfonts load asynchronously; drawing before they arrive silently falls
  // back to a system face and changes every measurement below.
  if (document.fonts?.ready) await document.fonts.ready;

  ctx.fillStyle = "#160f0a";
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

  if (backgroundUrl) {
    try {
      const image = await loadImage(backgroundUrl);
      const { sx, sy, sw, sh } = coverRect(
        image.naturalWidth,
        image.naturalHeight,
        IMAGE_WIDTH,
        IMAGE_HEIGHT,
      );
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
    } catch {
      // A missing background is not worth failing the whole share for.
    }
  }

  // A scrim, not a flat wash: the idol stays visible at the edges while the
  // middle darkens enough for white text to hold its contrast.
  const scrim = ctx.createLinearGradient(0, 0, 0, IMAGE_HEIGHT);
  scrim.addColorStop(0, "rgba(12, 8, 5, 0.82)");
  scrim.addColorStop(0.45, "rgba(12, 8, 5, 0.62)");
  scrim.addColorStop(1, "rgba(12, 8, 5, 0.88)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

  const pad = 84;
  const inner = IMAGE_WIDTH - pad * 2;
  const centre = IMAGE_WIDTH / 2;
  let y = 132;

  const centred = (
    text: string,
    font: string,
    colour: string,
    lineHeight: number,
  ) => {
    ctx.font = font;
    ctx.fillStyle = colour;
    ctx.textAlign = "center";
    for (const line of wrapText((t) => ctx.measureText(t).width, text, inner)) {
      ctx.fillText(line, centre, y);
      y += lineHeight;
    }
  };


  centred(data.mandalName, `600 70px ${DISPLAY}`, "#fdf6ec", 64);
  if (data.address) {
    y += 6;
    centred(data.address, `400 28px ${SANS}`, "rgba(253, 246, 236, 0.72)", 38);
  }

  y += 26;
  centred(
    data.title.toUpperCase(),
    `600 30px ${SANS}`,
    "rgba(240, 170, 90, 0.95)",
    42,
  );

  // The amount is what a contributor checks first, so it gets the space.
  y += 54;
  centred(data.amountLabel, `500 30px ${SANS}`, "rgba(253, 246, 236, 0.7)", 52);
  // 108px text needs ~80px of clearance above its own baseline, or the label
  // above it clips into the top of the digits.
  y += 48;
  centred(data.amount, `700 68px ${SANS}`, "#ffffff", 130);

  y += 40;
  ctx.fillStyle = "rgba(253, 246, 236, 0.22)";
  ctx.fillRect(pad, y, inner, 2);

  // Pushed down from the divider rather than sitting right under it, so the
  // donor name reads as centred between this divider and the next one.
  y += 88;
  centred(data.donorLabel, `400 28px ${SANS}`, "rgba(253, 246, 236, 0.7)", 95);
  y += 12;
  centred(data.donorName, `600 102px ${SANS}`, "#ffffff", 70);

  y += 18;
  ctx.fillStyle = "rgba(253, 246, 236, 0.22)";
  ctx.fillRect(pad, y, inner, 2);

  // Label left, value right — a ledger reads better aligned than centred.
  y += 62;
  for (const row of data.rows) {
    ctx.font = `400 32px ${SANS}`;
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(253, 246, 236, 0.72)";
    ctx.fillText(row.label, pad, y);

    ctx.font = `600 32px ${SANS}`;
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(row.value, IMAGE_WIDTH - pad, y);
    y += 52;
  }

  y = Math.min(Math.max(y + 64, IMAGE_HEIGHT - 150), IMAGE_HEIGHT - 120);
  centred(data.thanks, `600 46px ${DISPLAY}`, "#f6c17a", 36);
  if (data.footer) {
    y += 10;
    centred(data.footer, `400 26px ${SANS}`, "rgba(253, 246, 236, 0.6)", 24);
  }

  if (data.president || data.vicePresident) {
    y += 16;
    ctx.font = `500 30px ${SANS}`;
    ctx.fillStyle = "rgba(253, 246, 236, 0.55)";
    if (data.president) {
      ctx.textAlign = "left";
      ctx.fillText(`अध्यक्ष: ${data.president}`, pad, y);
    }
    if (data.vicePresident) {
      ctx.textAlign = "right";
      ctx.fillText(`उपाध्यक्ष: ${data.vicePresident}`, IMAGE_WIDTH - pad, y);
    }
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode-failed"))),
      "image/png",
    );
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Same-origin in practice, but this keeps the canvas untainted either way.
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image-load-failed"));
    image.src = url;
  });
}
