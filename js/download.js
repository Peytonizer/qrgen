// Per-card SVG/PNG export and the "download all" zip. See SPEC.md,
// "Download filenames", for the slugging rule this follows.

import { buildVCard } from './vcard.js';
import { buildQrOptions, createQrCode } from './qr.js';
import { composeCaptionedSvg, composeCaptionedCanvas } from './caption.js';

/** Lowercases, collapses spaces/punctuation to single hyphens, strips leading/trailing hyphens. */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * One filename-safe slug per entry (an array of `{ index, fields }`, as
 * produced by columns.js's `validateRows`), in the same order. Two people
 * with the same name get -2, -3 suffixes; a row whose name slugs to nothing
 * (e.g. entirely punctuation) falls back to `contact-{n}`, 1-based on the
 * row's original position.
 */
export function generateFilenameSlugs(entries) {
  const counts = new Map();
  return entries.map(({ index, fields }) => {
    const name = [fields.firstName, fields.lastName].filter(Boolean).join(' ');
    const base = slugify(name) || `contact-${index + 1}`;
    const count = (counts.get(base) || 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  });
}

/** Loads a Blob as an HTMLImageElement — used to draw a bare PNG QR onto the caption canvas. */
function loadImageBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (event) => {
      URL.revokeObjectURL(url);
      reject(event);
    };
    img.src = url;
  });
}

/**
 * Builds one card's SVG and PNG blobs at `size` × `size` (before any
 * caption is added). When `captionsEnabled`, both are composited per
 * caption.js; otherwise they're exactly qr-code-styling's own output —
 * "caption off" must be pixel-for-pixel the same bare code as always.
 */
export async function buildCardBlobs({ fields, style, preset, size, captionsEnabled }) {
  const options = buildQrOptions({
    data: buildVCard(fields),
    size,
    foreground: style.foreground,
    background: style.background,
    dotsType: preset.dotsType,
    cornersSquareType: preset.cornersSquareType,
  });
  const qr = createQrCode(options);

  const bareSvgText = await (await qr.getRawData('svg')).text();
  const svgBlob = captionsEnabled
    ? new Blob([composeCaptionedSvg({ qrSvgString: bareSvgText, fields, background: style.background, size })], {
        type: 'image/svg+xml;charset=utf-8',
      })
    : new Blob([bareSvgText], { type: 'image/svg+xml;charset=utf-8' });

  const barePngBlob = await qr.getRawData('png');
  const pngBlob = captionsEnabled
    ? await new Promise((resolve) => {
        loadImageBlob(barePngBlob).then((bareImage) => {
          const canvas = composeCaptionedCanvas({ qrImage: bareImage, fields, background: style.background, size });
          canvas.toBlob(resolve, 'image/png');
        });
      })
    : barePngBlob;

  return { svgBlob, pngBlob };
}

/** Triggers a browser download of `blob` as `filename` via a throwaway object URL. */
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Builds a zip containing every entry's SVG and PNG, named by `filenames`
 * (same order, from generateFilenameSlugs). Generation is sequential —
 * fine at v1's expected batch sizes, and simpler than parallelising against
 * JSZip's single in-memory archive.
 */
export async function buildZipBlob(entries, filenames, { style, preset, size, captionsEnabled }) {
  const zip = new JSZip();
  for (let i = 0; i < entries.length; i += 1) {
    const { svgBlob, pngBlob } = await buildCardBlobs({ fields: entries[i].fields, style, preset, size, captionsEnabled });
    zip.file(`${filenames[i]}.svg`, svgBlob);
    zip.file(`${filenames[i]}.png`, pngBlob);
  }
  return zip.generateAsync({ type: 'blob' });
}
