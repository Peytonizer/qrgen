// qr-code-styling wrapper: the four presets and the colour guardrails. Error
// correction is fixed at Q throughout — v1 has no centre logo, so H's extra
// bulk isn't needed, and Q survives the scuffs a printed card picks up. See
// SPEC.md, "Style presets" and "Colour guardrails".

const ERROR_CORRECTION_LEVEL = 'Q';

/**
 * Four presets, exact values from SPEC.md so the shipped app matches the
 * mockup rather than being re-invented. All are dark-on-white; a gradient
 * foreground has `stops` (and `rotation`, in radians) instead of `color`.
 */
export const PRESETS = [
  {
    id: 'classic',
    name: 'Classic',
    background: '#FFFFFF',
    foreground: { color: '#111111' },
    dotsType: 'square',
    cornersSquareType: 'square',
  },
  {
    id: 'rounded',
    name: 'Rounded',
    background: '#FFFFFF',
    foreground: { color: '#1C1C22' },
    dotsType: 'rounded',
    cornersSquareType: 'extra-rounded',
  },
  {
    id: 'ink',
    name: 'Ink',
    background: '#FFFFFF',
    foreground: { color: '#16264A' },
    dotsType: 'extra-rounded',
    cornersSquareType: 'extra-rounded',
  },
  {
    id: 'gradient',
    name: 'Gradient',
    background: '#FFFFFF',
    // Linear, 45°. qr-code-styling takes rotation in radians (Math.PI === 180°).
    foreground: { stops: ['#1A2B4C', '#5A2350'], rotation: Math.PI / 4 },
    dotsType: 'rounded',
    cornersSquareType: 'extra-rounded',
  },
];

/** True when `foreground` is a gradient (`{ stops, rotation }`) rather than a solid `{ color }`. */
export function isGradient(foreground) {
  return Array.isArray(foreground?.stops);
}

// --- Colour guardrails -----------------------------------------------------
// Two rules enforced on every colour change before the preview re-renders.
// Kept out of the UI layer so a future feature (gradients, logo) can reuse
// the same check. Uses the standard WCAG formulas exactly as specified —
// not a cheaper brightness approximation, which gets mid-tone colours wrong
// in exactly the range where the answer matters.

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channelLuminance(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a hex colour. */
export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(channelLuminance);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours (order-independent). */
export function contrastRatio(hexA, hexB) {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Checks one foreground/background pair against both guardrails. Returns
 * `{ status: 'blocked'|'caution'|'ok', ratio, reason }` — `reason` is a
 * user-facing sentence for 'blocked'/'caution', `null` for 'ok'.
 *
 * Rule 1 (hard block): the foreground must be darker than the background —
 * a light-on-dark code fails on a significant share of scanners regardless
 * of how much contrast it has, so there is no legitimate inverted pairing.
 *
 * Rule 2: contrast ratio, banded at 4:1 (hard block below) and 7:1 (caution
 * below, silent pass above). The 4:1 floor is deliberately stricter than it
 * looks — QR scanning happens under worse conditions than reading a screen.
 */
export function checkColours(foreground, background) {
  const fgLum = relativeLuminance(foreground);
  const bgLum = relativeLuminance(background);
  const ratio = contrastRatio(foreground, background);

  if (fgLum >= bgLum) {
    return {
      status: 'blocked',
      ratio,
      reason:
        'The foreground must be darker than the background — light-on-dark codes fail on a lot of scanners no matter how much contrast they have.',
    };
  }
  if (ratio < 4) {
    return {
      status: 'blocked',
      ratio,
      reason: `Contrast ratio is only ${ratio.toFixed(1)}:1. It needs to be at least 4:1 or the code may not scan reliably.`,
    };
  }
  if (ratio < 7) {
    return {
      status: 'caution',
      ratio,
      reason: `Contrast ratio is ${ratio.toFixed(1)}:1 — this code may scan slowly in poor light or at small print sizes.`,
    };
  }
  return { status: 'ok', ratio, reason: null };
}

const STATUS_SEVERITY = { blocked: 2, caution: 1, ok: 0 };

/**
 * Checks a gradient foreground (both colour stops) against the background
 * and returns the worse of the two verdicts — a gradient has no single
 * foreground, so both stops must clear the guardrails.
 */
export function checkGradientColours(stops, background) {
  return stops
    .map((color) => checkColours(color, background))
    .reduce((worst, result) => {
      if (STATUS_SEVERITY[result.status] > STATUS_SEVERITY[worst.status]) return result;
      if (STATUS_SEVERITY[result.status] === STATUS_SEVERITY[worst.status] && result.ratio < worst.ratio) return result;
      return worst;
    });
}

// --- qr-code-styling options -----------------------------------------------

/**
 * Builds a qr-code-styling options object for one card. `foreground` is
 * either `{ color }` (solid) or `{ stops: [c1, c2], rotation }` (gradient).
 * The same colour is applied to dots, both corner styles and the
 * background, so a custom colour pick isn't only partial. `margin` acts as
 * the code's quiet zone.
 */
export function buildQrOptions({ data, size, foreground, background, dotsType, cornersSquareType }) {
  const colorOptions = isGradient(foreground)
    ? {
        gradient: {
          type: 'linear',
          rotation: foreground.rotation ?? 0,
          colorStops: [
            { offset: 0, color: foreground.stops[0] },
            { offset: 1, color: foreground.stops[1] },
          ],
        },
      }
    : { color: foreground.color };

  return {
    width: size,
    height: size,
    type: 'svg',
    data,
    margin: Math.round(size * 0.04),
    qrOptions: { errorCorrectionLevel: ERROR_CORRECTION_LEVEL },
    backgroundOptions: { color: background },
    dotsOptions: { type: dotsType, ...colorOptions },
    cornersSquareOptions: { type: cornersSquareType, ...colorOptions },
    cornersDotOptions: { ...colorOptions },
  };
}

/** Creates a new QRCodeStyling instance (global `QRCodeStyling`, from vendor/qr-code-styling.js). */
export function createQrCode(options) {
  return new QRCodeStyling(options);
}
