// Wraps SheetJS: reads the first worksheet of an uploaded file into an array of
// plain row objects keyed by header. Handles .xlsx, .xls and .csv through one
// API, so there's no separate CSV parser and no behavioural divergence between
// the two input paths (see SPEC.md, "Decisions made, and why").

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

/** True if the filename has one of the accepted extensions. */
export function isAcceptedFile(file) {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Reads the first worksheet of `file` and resolves to `{ headers, rows }`:
 * `headers` is the first row in column order, `rows` is an array of row
 * objects keyed by header with fully blank rows dropped.
 *
 * Cells are read as formatted text (`raw: false`), not raw values — Excel
 * stores a number like "0412 345 678" as a number and strips the leading
 * zero, so reading raw values would silently corrupt phone numbers. Reading
 * formatted text preserves what the user actually sees in the cell.
 *
 * Blank rows are filtered explicitly rather than relying on SheetJS's
 * `blankrows` option: a row whose cells all exist but hold an empty string
 * (common when a spreadsheet is exported from another tool) still counts as
 * "blank" to SheetJS's own check, which only elides rows with no cells at all.
 *
 * A `.csv` is decoded as UTF-8 text before handing it to SheetJS, rather than
 * passed as raw bytes (`type: 'array'`). CSV has no encoding metadata of its
 * own, and without a BOM SheetJS's byte-oriented reader mis-decodes multi-byte
 * characters (e.g. "Zoë" becomes "ZoÃ«"). `.xlsx`/`.xls` stay on `type: 'array'`
 * — they're binary containers with their own internal encoding.
 */
export function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.onload = () => {
      try {
        const isCsv = file.name.toLowerCase().endsWith('.csv');
        const workbook = isCsv
          ? XLSX.read(new TextDecoder('utf-8').decode(reader.result), { type: 'string' })
          : XLSX.read(new Uint8Array(reader.result), { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          reject(new Error(`"${file.name}" has no worksheets.`));
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        const headerRow = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })[0] || [];
        const allRows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });
        const rows = allRows.filter((row) => Object.values(row).some((value) => String(value).trim() !== ''));
        resolve({ headers: headerRow, rows });
      } catch (err) {
        reject(new Error(`Could not parse "${file.name}": ${err.message}`));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
