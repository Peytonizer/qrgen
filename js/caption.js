// Caption compositing for both export paths — PNG (an offscreen canvas) and
// SVG (an outer <svg> wrapping the QR's own). See SPEC.md, "Captions", for
// the exact content, layout and edge cases this follows.
//
// This is a compositing feature, not a CSS one: a caption implemented as
// page styling around a QR image would give a captioned preview and an
// uncaptioned download. Both paths here build the caption directly into the
// output, so what you see is what you get.

// All dimensions scale from the QR's edge length S.
const SIDE_PADDING = 0.06;
const GAP = 0.07;
const NAME_SIZE = 0.075;
const MIN_NAME_SIZE = 0.05;
const NAME_SHRINK_STEP = 0.001;
const DETAIL_SIZE = 0.05;
const LINE_SPACING = 1.35;
const BOTTOM_PADDING = 0.06;

// The card is always white with near-black text regardless of the app's own
// theme (SPEC.md, "Visual direction") — it represents a printed artefact, so
// these are fixed literals, not the app's --ink/--ink-muted custom properties.
const NAME_COLOR = '#17171a';
const DETAIL_COLOR = '#5f5f6b';

// Display face for the name, UI sans for the detail lines — per SPEC.md
// "Typography". The named fonts aren't self-hosted yet (that's a build step
// 8 concern); until then these stacks silently fall back to their generic
// end, and pick up the real files the moment step 8 links them.
const NAME_FONT = `"Bricolage Grotesque", Georgia, serif`;
const DETAIL_FONT = `"IBM Plex Sans", -apple-system, "Segoe UI", sans-serif`;

/**
 * Escapes &, < and > for safe insertion into SVG <text> content. This is a
 * *different* rule from the vCard escaper in vcard.js — which escapes
 * commas and semicolons — and must not be reused here, or a name like
 * "Margaret Smith, Jr" would render its comma escaped instead of literal.
 */
function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let measureCanvas = null;
function measureContext() {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  return measureCanvas.getContext('2d');
}

function textWidth(ctx, text, fontPx, fontFamily, fontWeight) {
  ctx.font = `${fontWeight} ${fontPx}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

/**
 * Greedily wraps `text` onto at most `maxLines` lines that fit `maxWidth`.
 * Once the last allowed line is reached, remaining words are appended to it
 * regardless of width rather than dropped — SPEC.md doesn't ask for
 * truncation beyond two lines, and content must never silently disappear.
 */
function wrapText(ctx, text, fontPx, fontFamily, fontWeight, maxWidth, maxLines) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const onLastAllowedLine = lines.length === maxLines - 1;
    if (onLastAllowedLine || !current || textWidth(ctx, candidate, fontPx, fontFamily, fontWeight) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Works out the name's font size and line(s): shrinks from NAME_SIZE down to
 * MIN_NAME_SIZE (fractions of S) while it still fits on one line; if it still
 * doesn't fit at the minimum, wraps to a maximum of two lines at that size.
 */
function fitName(ctx, name, size, maxWidth) {
  for (let frac = NAME_SIZE; frac >= MIN_NAME_SIZE; frac -= NAME_SHRINK_STEP) {
    const px = frac * size;
    if (textWidth(ctx, name, px, NAME_FONT, '600') <= maxWidth) {
      return { fontPx: px, lines: [name] };
    }
  }
  const px = MIN_NAME_SIZE * size;
  return { fontPx: px, lines: wrapText(ctx, name, px, NAME_FONT, '600', maxWidth, 2) };
}

/**
 * Computes the caption's lines and overall size for a card of edge length
 * `size` (S). Returns `{ width, height, lines }` where `lines` is an
 * ordered array of `{ text, fontPx, fontFamily, fontWeight, color, baseline }`
 * ready to draw — `baseline` is the y-coordinate for both Canvas fillText
 * (default alphabetic baseline) and SVG <text y>, so the same layout serves
 * both compositing paths.
 *
 * Fields omitted from `fields` produce no line: name is always present (the
 * validation rule guarantees at least one name part), email and phone are
 * each optional, and only one phone (mobile, else work) is ever shown.
 */
export function computeCaptionLayout(fields, size) {
  const ctx = measureContext();
  const maxWidth = size * (1 - 2 * SIDE_PADDING);
  const name = [fields.firstName, fields.lastName].filter(Boolean).join(' ');
  const email = fields.email || '';
  const phone = fields.mobile || fields.workPhone || '';

  const { fontPx: namePx, lines: nameLines } = fitName(ctx, name, size, maxWidth);

  const lines = [];
  let cursorTop = size + GAP * size;

  nameLines.forEach((text) => {
    const advance = namePx * LINE_SPACING;
    lines.push({ text, fontPx: namePx, fontFamily: NAME_FONT, fontWeight: '600', color: NAME_COLOR, baseline: cursorTop + namePx });
    cursorTop += advance;
  });

  const detailPx = DETAIL_SIZE * size;
  [email, phone].filter(Boolean).forEach((text) => {
    const advance = detailPx * LINE_SPACING;
    lines.push({ text, fontPx: detailPx, fontFamily: DETAIL_FONT, fontWeight: 'normal', color: DETAIL_COLOR, baseline: cursorTop + detailPx });
    cursorTop += advance;
  });

  const height = cursorTop + BOTTOM_PADDING * size;
  return { width: size, height, lines };
}

/**
 * PNG path: draws `qrImage` (any CanvasImageSource already rendered at
 * `size` × `size`, e.g. the QR's own canvas or an Image loaded from its SVG)
 * onto a new canvas of the composited size, with the caption beneath it.
 * Returns the canvas — the caller decides how to export it (toBlob, etc.).
 */
export function composeCaptionedCanvas({ qrImage, fields, background, size }) {
  const layout = computeCaptionLayout(fields, size);
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(qrImage, 0, 0, size, size);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  layout.lines.forEach((line) => {
    ctx.font = `${line.fontWeight} ${line.fontPx}px ${line.fontFamily}`;
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, layout.width / 2, line.baseline);
  });

  return canvas;
}

const XML_PROLOG = /^\s*<\?xml[^>]*\?>\s*/i;

/**
 * SVG path: wraps `qrSvgString` (the QR's own serialized `<svg>`, rendered at
 * `size` × `size`) in a new outer `<svg>` with the caption's `<text>`
 * elements added beneath it. Returns the full SVG document as a string,
 * with a UTF-8 XML declaration so non-ASCII names survive (see SPEC.md,
 * "Non-ASCII").
 */
export function composeCaptionedSvg({ qrSvgString, fields, background, size }) {
  const layout = computeCaptionLayout(fields, size);
  const innerQr = qrSvgString.replace(XML_PROLOG, '');

  const textElements = layout.lines
    .map(
      (line) =>
        `<text x="${layout.width / 2}" y="${line.baseline}" text-anchor="middle" font-family='${line.fontFamily}' font-size="${line.fontPx}" font-weight="${line.fontWeight}" fill="${line.color}">${escapeXml(line.text)}</text>`
    )
    .join('');

  return (
    `<?xml version="1.0" encoding="utf-8" standalone="no"?>\r\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">` +
    `<rect width="${layout.width}" height="${layout.height}" fill="${background}"/>` +
    innerQr +
    textElements +
    `</svg>`
  );
}
