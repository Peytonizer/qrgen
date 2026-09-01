// Entry point: wires the drop zone, the step rail, and column mapping together.
// Style and download (steps 3-4) are placeholders until later build steps —
// see SPEC.md, "Build order".

import { isAcceptedFile, parseFile } from './parse.js';
import { createStepRail } from './steps.js';
import { FIELDS, FIELD_LABELS, detectMapping, validateRows } from './columns.js';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const errorEl = document.getElementById('parse-error');
const mappingGrid = document.getElementById('mapping-grid');
const rowReview = document.getElementById('row-review');

const stepRail = createStepRail(
  document.querySelector('.step-rail'),
  [...document.querySelectorAll('.step-panel')]
);

// The current file's parsed data and mapping. Re-populated on each successful
// parse; mapping is mutated in place as the user corrects the mapping selects.
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

/** Re-validates the current rows against the current mapping and re-renders the review tables. */
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
}

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
    state = { headers, rows, mapping: detectMapping(headers) };
    renderMappingGrid();
    renderRowReview();
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
