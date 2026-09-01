// Entry point. Build step 2 wires the drop zone and file picker to parse.js and
// dumps the raw parsed rows into a table — no column mapping or QR generation
// yet, those land in later build steps (see SPEC.md, "Build order").

import { isAcceptedFile, parseFile } from './parse.js';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const errorEl = document.getElementById('parse-error');
const tableSection = document.getElementById('table-section');
const table = document.getElementById('preview-table');

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  tableSection.hidden = true;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

function renderTable(headers, rows) {
  table.innerHTML = '';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headers.forEach((header) => {
    const th = document.createElement('th');
    th.textContent = header;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    headers.forEach((header) => {
      const td = document.createElement('td');
      td.textContent = row[header] ?? '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  tableSection.hidden = false;
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
    renderTable(headers, rows);
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
