// Entry point: wires the drop zone, the step rail, column mapping, the
// style/preview (hero card + filmstrip) and downloads together.

import { isAcceptedFile, parseFile } from './parse.js';
import { createStepRail } from './steps.js';
import { FIELDS, FIELD_LABELS, detectMapping, validateRows } from './columns.js';
import { buildVCard } from './vcard.js';
import { PRESETS, isGradient, checkColours, checkGradientColours, buildQrOptions, createQrCode } from './qr.js';
import { composeCaptionedSvg } from './caption.js';
import { generateFilenameSlugs, buildCardBlobs, buildZipBlob, triggerDownload } from './download.js';

const QR_PREVIEW_SIZE = 220;
const QR_FILMSTRIP_SIZE = 120;
// Target at least 1000px square for the code itself, before the caption is
// added — high enough to print (SPEC.md, build order step 7).
const QR_EXPORT_SIZE = 1000;

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const errorEl = document.getElementById('parse-error');
const loadingStatus = document.getElementById('loading-status');
const mappingGrid = document.getElementById('mapping-grid');
const rowReview = document.getElementById('row-review');
const presetPicker = document.getElementById('preset-picker');
const fgColorInput = document.getElementById('fg-color');
const bgColorInput = document.getElementById('bg-color');
const resetToPresetBtn = document.getElementById('reset-to-preset');
const colourStatus = document.getElementById('colour-status');
const captionToggle = document.getElementById('caption-toggle');
const contrastReadout = document.getElementById('contrast-readout');
const heroCard = document.getElementById('hero-card');
const filmstrip = document.getElementById('filmstrip');
const downloadAllBtn = document.getElementById('download-all');
const downloadGrid = document.getElementById('download-grid');

const stepRail = createStepRail(
  document.querySelector('.step-rail'),
  [...document.querySelectorAll('.step-panel')]
);

// The current file's parsed data, mapping and style choice. Re-populated on
// each successful parse; mapping and style are mutated in place as the user
// adjusts the mapping selects, preset and colour wells.
let state = null;

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

/** Builds the mapping selects: one per field, options are the file's headers plus "— none —". */
function renderMappingGrid() {
  mappingGrid.innerHTML = '';
  FIELDS.forEach((field) => {
    const row = document.createElement('label');
    row.className = 'mapping-row';

    const span = document.createElement('span');
    span.className = 'mapping-row__label';
    span.textContent = FIELD_LABELS[field];
    row.appendChild(span);

    const select = document.createElement('select');
    select.dataset.field = field;

    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.textContent = '— none —';
    select.appendChild(noneOption);

    state.headers.forEach((header) => {
      const option = document.createElement('option');
      option.value = header;
      option.textContent = header;
      select.appendChild(option);
    });

    select.value = state.mapping[field] ?? '';
    select.addEventListener('change', () => {
      state.mapping[field] = select.value || null;
      renderRowReview();
    });

    row.appendChild(select);
    mappingGrid.appendChild(row);
  });
}

function buildFieldsTable(entries, { withReason }) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  FIELDS.forEach((field) => {
    const th = document.createElement('th');
    th.textContent = FIELD_LABELS[field];
    headRow.appendChild(th);
  });
  if (withReason) {
    const th = document.createElement('th');
    th.textContent = 'Reason';
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  entries.forEach((entry) => {
    const tr = document.createElement('tr');
    if (withReason) tr.className = 'row-skipped';
    FIELDS.forEach((field) => {
      const td = document.createElement('td');
      td.textContent = entry.fields[field];
      tr.appendChild(td);
    });
    if (withReason) {
      const td = document.createElement('td');
      td.textContent = entry.reason;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

/**
 * Re-validates the current rows against the current mapping, re-renders the
 * review tables, and regenerates the style preview grid (its inputs — the
 * valid rows — just changed).
 */
function renderRowReview() {
  const { valid, skipped } = validateRows(state.rows, state.mapping);
  state.valid = valid;
  state.skipped = skipped;

  rowReview.innerHTML = '';

  const summary = document.createElement('p');
  summary.className = 'row-review__summary';
  summary.textContent = `${valid.length} valid, ${skipped.length} skipped`;
  rowReview.appendChild(summary);

  const validWrap = document.createElement('div');
  validWrap.className = 'table-scroll';
  validWrap.appendChild(buildFieldsTable(valid, { withReason: false }));
  rowReview.appendChild(validWrap);

  if (skipped.length > 0) {
    const heading = document.createElement('h3');
    heading.textContent = 'Skipped rows';
    rowReview.appendChild(heading);

    const skippedWrap = document.createElement('div');
    skippedWrap.className = 'table-scroll';
    skippedWrap.appendChild(buildFieldsTable(skipped, { withReason: true }));
    rowReview.appendChild(skippedWrap);
  }

  renderStylePreview();
  renderDownloadGrid();
}

// --- Style: preset picker, colour wells, preview grid -----------------------

function currentPreset() {
  return PRESETS.find((preset) => preset.id === state.style.presetId);
}

function renderPresetPicker() {
  presetPicker.innerHTML = '';
  PRESETS.forEach((preset) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset-tile';
    button.classList.toggle('is-selected', preset.id === state.style.presetId);

    const swatch = document.createElement('span');
    swatch.className = 'preset-tile__swatch';
    swatch.style.background = isGradient(preset.foreground)
      ? `linear-gradient(45deg, ${preset.foreground.stops[0]}, ${preset.foreground.stops[1]})`
      : preset.foreground.color;
    button.appendChild(swatch);

    button.appendChild(document.createTextNode(preset.name));
    button.addEventListener('click', () => selectPreset(preset.id));
    presetPicker.appendChild(button);
  });
}

/** Selects a preset: resets both colours to its values and clears any "modified" edit. */
function selectPreset(id) {
  const preset = PRESETS.find((p) => p.id === id);
  state.style = {
    presetId: preset.id,
    foreground: isGradient(preset.foreground) ? { ...preset.foreground, stops: [...preset.foreground.stops] } : { ...preset.foreground },
    background: preset.background,
  };
  updateContrastReadout();
  hideColourStatus();
  renderPresetPicker();
  renderColourWells();
  renderStylePreview();
}

function hideColourStatus() {
  colourStatus.hidden = true;
  colourStatus.textContent = '';
  colourStatus.classList.remove('is-blocked', 'is-caution');
}

function showColourStatus(verdict) {
  if (verdict.status === 'ok') {
    hideColourStatus();
    return;
  }
  colourStatus.hidden = false;
  colourStatus.textContent = verdict.reason;
  colourStatus.classList.toggle('is-blocked', verdict.status === 'blocked');
  colourStatus.classList.toggle('is-caution', verdict.status === 'caution');
}

/** Always-visible "N.N:1" readout for the current foreground/background pair (SPEC.md's "contrast readout"). */
function updateContrastReadout() {
  const verdict = isGradient(state.style.foreground)
    ? checkGradientColours(state.style.foreground.stops, state.style.background)
    : checkColours(state.style.foreground.color, state.style.background);
  contrastReadout.textContent = `Contrast ${verdict.ratio.toFixed(1)}:1`;
}

/** Syncs the colour well inputs to state.style. The foreground well is disabled for the Gradient preset — it has no single colour to edit (see SPEC.md; resolved with Matt as: disable rather than reinterpret). */
function renderColourWells() {
  const gradient = isGradient(state.style.foreground);
  fgColorInput.disabled = gradient;
  fgColorInput.value = gradient ? state.style.foreground.stops[0] : state.style.foreground.color;
  bgColorInput.value = state.style.background;
}

fgColorInput.addEventListener('input', () => {
  const hex = fgColorInput.value;
  const verdict = checkColours(hex, state.style.background);
  if (verdict.status === 'blocked') {
    showColourStatus(verdict);
    fgColorInput.value = state.style.foreground.color;
    return;
  }
  state.style.foreground = { color: hex };
  showColourStatus(verdict);
  updateContrastReadout();
  renderStylePreview();
});

bgColorInput.addEventListener('input', () => {
  const hex = bgColorInput.value;
  const verdict = isGradient(state.style.foreground)
    ? checkGradientColours(state.style.foreground.stops, hex)
    : checkColours(state.style.foreground.color, hex);
  if (verdict.status === 'blocked') {
    showColourStatus(verdict);
    bgColorInput.value = state.style.background;
    return;
  }
  state.style.background = hex;
  showColourStatus(verdict);
  updateContrastReadout();
  renderStylePreview();
});

resetToPresetBtn.addEventListener('click', () => selectPreset(state.style.presetId));

captionToggle.addEventListener('change', () => {
  state.captionsEnabled = captionToggle.checked;
  renderStylePreview();
});

/**
 * Renders one bare QR (no caption) into `container` for `fields`, using the
 * current style, at `size`. Returns the QRCodeStyling instance.
 */
function renderBareQr(container, fields, preset, size) {
  const qr = createQrCode(
    buildQrOptions({
      data: buildVCard(fields),
      size,
      foreground: state.style.foreground,
      background: state.style.background,
      dotsType: preset.dotsType,
      cornersSquareType: preset.cornersSquareType,
    })
  );
  qr.append(container);
  return qr;
}

/**
 * Renders one card into `container` at `size`: bare, or — when captions are
 * on — the actual composited SVG (caption.js), not a CSS approximation, so
 * the preview stays truthful to what gets exported (see SPEC.md, "Captions").
 */
function renderCard(container, fields, preset, size) {
  if (state.captionsEnabled) {
    // Render the bare QR off-DOM just to get its serialized SVG, then
    // composite the real caption around it for display.
    const offDom = document.createElement('div');
    renderBareQr(offDom, fields, preset, size);
    const bareSvg = offDom.querySelector('svg');
    const svgString = bareSvg ? new XMLSerializer().serializeToString(bareSvg) : '';
    container.innerHTML = composeCaptionedSvg({ qrSvgString: svgString, fields, background: state.style.background, size });
  } else {
    renderBareQr(container, fields, preset, size);
  }
}

/**
 * Renders the Style step's preview: one large "hero" card for the first
 * valid row, and a filmstrip of smaller cards for the rest (SPEC.md,
 * "Interface — Walkthrough").
 */
function renderStylePreview() {
  heroCard.innerHTML = '';
  filmstrip.innerHTML = '';
  if (!state.valid) return;

  if (state.valid.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hero-card__empty';
    empty.textContent = 'No valid rows to preview yet — check the column mapping in step 2.';
    heroCard.appendChild(empty);
    return;
  }

  const preset = currentPreset();
  const [hero, ...rest] = state.valid;

  renderCard(heroCard, hero.fields, preset, QR_PREVIEW_SIZE);

  rest.forEach(({ fields }) => {
    const card = document.createElement('div');
    card.className = 'filmstrip__card';
    filmstrip.appendChild(card);
    renderCard(card, fields, preset, QR_FILMSTRIP_SIZE);
  });
}

// --- Download: per-card SVG/PNG buttons and the "download all" zip --------

/** Current export options shared by every card: the export size, style and caption setting. */
function exportOptions() {
  return { style: state.style, preset: currentPreset(), size: QR_EXPORT_SIZE, captionsEnabled: state.captionsEnabled };
}

/** Runs `task` with `button` disabled and its label swapped to `busyLabel`, restoring both after. */
async function withBusyButton(button, busyLabel, task) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = busyLabel;
  try {
    await task();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

/** Rebuilds the download grid: one row per valid entry, with SVG/PNG buttons that build and download that card's files on click. */
function renderDownloadGrid() {
  downloadGrid.innerHTML = '';
  if (!state.valid) return;

  const slugs = generateFilenameSlugs(state.valid);

  state.valid.forEach(({ fields }, i) => {
    const row = document.createElement('div');
    row.className = 'download-row';

    const name = document.createElement('span');
    name.className = 'download-row__name';
    name.textContent = [fields.firstName, fields.lastName].filter(Boolean).join(' ');
    row.appendChild(name);

    ['svg', 'png'].forEach((format) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = format.toUpperCase();
      button.addEventListener('click', () =>
        withBusyButton(button, '…', async () => {
          const { svgBlob, pngBlob } = await buildCardBlobs({ fields, ...exportOptions() });
          const blob = format === 'svg' ? svgBlob : pngBlob;
          triggerDownload(blob, `${slugs[i]}.${format}`);
        })
      );
      row.appendChild(button);
    });

    downloadGrid.appendChild(row);
  });
}

downloadAllBtn.addEventListener('click', () =>
  withBusyButton(downloadAllBtn, 'Building zip…', async () => {
    const slugs = generateFilenameSlugs(state.valid);
    const zipBlob = await buildZipBlob(state.valid, slugs, exportOptions());
    triggerDownload(zipBlob, 'qr-codes.zip');
  })
);

// --- File loading -------------------------------------------------------

async function handleFile(file) {
  if (!file) return;
  if (!isAcceptedFile(file)) {
    showError(`"${file.name}" isn't a spreadsheet qrgen can read. Accepted formats: .xlsx, .xls, .csv.`);
    return;
  }
  clearError();
  loadingStatus.textContent = `Reading "${file.name}"…`;
  loadingStatus.hidden = false;
  try {
    const { headers, rows } = await parseFile(file);
    if (rows.length === 0) {
      showError(`"${file.name}" has no data rows.`);
      return;
    }
    state = { headers, rows, mapping: detectMapping(headers), style: null, captionsEnabled: captionToggle.checked };
    renderMappingGrid();
    selectPreset(PRESETS[0].id); // also renders the colour wells and readout
    renderRowReview(); // computes state.valid/skipped and renders the real preview
    stepRail.unlock([2, 3, 4]);
    stepRail.goTo(2);
  } catch (err) {
    showError(err.message);
  } finally {
    loadingStatus.hidden = true;
  }
}

fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('dragover');
  handleFile(event.dataTransfer.files[0]);
});

// Clicking anywhere on the dropzone (not just the "Choose file" label) opens
// the file dialog; Enter/Space does the same when it's focused via keyboard.
dropzone.addEventListener('click', (event) => {
  if (event.target !== fileInput && event.target.closest('label') === null) {
    fileInput.click();
  }
});

dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
});
