// Entry point: wires the drop zone, the step rail, column mapping and the
// style/preview grid together. Download (step 4) is a placeholder until its
// own build step — see SPEC.md, "Build order".

import { isAcceptedFile, parseFile } from './parse.js';
import { createStepRail } from './steps.js';
import { FIELDS, FIELD_LABELS, detectMapping, validateRows } from './columns.js';
import { buildVCard } from './vcard.js';
import { PRESETS, isGradient, checkColours, checkGradientColours, buildQrOptions, createQrCode } from './qr.js';
import { composeCaptionedSvg } from './caption.js';

const QR_PREVIEW_SIZE = 220;

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const errorEl = document.getElementById('parse-error');
const mappingGrid = document.getElementById('mapping-grid');
const rowReview = document.getElementById('row-review');
const presetPicker = document.getElementById('preset-picker');
const fgColorInput = document.getElementById('fg-color');
const bgColorInput = document.getElementById('bg-color');
const resetToPresetBtn = document.getElementById('reset-to-preset');
const colourStatus = document.getElementById('colour-status');
const captionToggle = document.getElementById('caption-toggle');
const qrGrid = document.getElementById('qr-grid');

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

  renderQrGrid();
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
  hideColourStatus();
  renderPresetPicker();
  renderColourWells();
  renderQrGrid();
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
  renderQrGrid();
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
  renderQrGrid();
});

resetToPresetBtn.addEventListener('click', () => selectPreset(state.style.presetId));

captionToggle.addEventListener('change', () => {
  state.captionsEnabled = captionToggle.checked;
  renderQrGrid();
});

/**
 * Renders one bare QR (no caption) into `container` for `fields`, using the
 * current style. Returns the QRCodeStyling instance.
 */
function renderBareQr(container, fields, preset) {
  const qr = createQrCode(
    buildQrOptions({
      data: buildVCard(fields),
      size: QR_PREVIEW_SIZE,
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
 * Regenerates the preview grid: one QR card per currently valid row. When
 * captions are on, each card shows the actual composited SVG (caption.js) —
 * not a CSS approximation — so the preview stays truthful to what gets
 * exported (see SPEC.md, "Captions").
 */
function renderQrGrid() {
  qrGrid.innerHTML = '';
  if (!state.valid) return;

  const preset = currentPreset();
  state.valid.forEach(({ fields }) => {
    const card = document.createElement('div');
    card.className = 'qr-card';

    const qrContainer = document.createElement('div');
    card.appendChild(qrContainer);

    if (state.captionsEnabled) {
      // Render the bare QR off-DOM just to get its serialized SVG, then
      // composite the real caption around it for display.
      const offDom = document.createElement('div');
      renderBareQr(offDom, fields, preset);
      const bareSvg = offDom.querySelector('svg');
      const svgString = bareSvg ? new XMLSerializer().serializeToString(bareSvg) : '';
      qrContainer.innerHTML = composeCaptionedSvg({
        qrSvgString: svgString,
        fields,
        background: state.style.background,
        size: QR_PREVIEW_SIZE,
      });
    } else {
      renderBareQr(qrContainer, fields, preset);
      // Only shown when captions are off — with them on, the composited
      // card already carries the name, and repeating it would be redundant.
      const name = document.createElement('p');
      name.className = 'qr-card__name';
      name.textContent = [fields.firstName, fields.lastName].filter(Boolean).join(' ');
      card.appendChild(name);
    }

    qrGrid.appendChild(card);
  });
}

// --- File loading -------------------------------------------------------

async function handleFile(file) {
  if (!file) return;
  if (!isAcceptedFile(file)) {
    showError(`"${file.name}" isn't a spreadsheet qrgen can read. Accepted formats: .xlsx, .xls, .csv.`);
    return;
  }
  clearError();
  try {
    const { headers, rows } = await parseFile(file);
    if (rows.length === 0) {
      showError(`"${file.name}" has no data rows.`);
      return;
    }
    state = { headers, rows, mapping: detectMapping(headers), style: null, captionsEnabled: captionToggle.checked };
    renderMappingGrid();
    selectPreset(PRESETS[0].id); // also renders the colour wells and (empty) grid
    renderRowReview(); // computes state.valid/skipped and renders the real grid
    stepRail.unlock([2, 3, 4]);
    stepRail.goTo(2);
  } catch (err) {
    showError(err.message);
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
