// Fictional example data for the "Download a template" and "Download sample data"
// buttons on step 1. Generated client-side via SheetJS rather than committed as a
// spreadsheet file — consistent with the project's rule against ever having a
// spreadsheet file in the repo, even a fictional one (see CLAUDE.md, PUBLISHING AND
// HISTORY / GIT & GITHUB). Headers use the exact spelling columns.js's synonym lists
// match first for each field, so re-uploading either file auto-maps every column.

export const TEMPLATE_HEADERS = ['First Name', 'Surname', 'Email Address', 'Mobile Phone', 'Work Phone'];

// Fictional people: @example.com addresses (reserved for documentation by RFC 2606)
// and made-up phone numbers — not real contact data, just enough rows to show the
// expected shape, including that not every row needs every field.
const SAMPLE_ROWS = [
  ['Ana', 'Torres', 'ana.torres@example.com', '0412 345 678', ''],
  ['Ben', 'Carter', 'ben.carter@example.com', '', '03 9123 4567'],
  ['Chloe', 'Nguyen', 'chloe.nguyen@example.com', '0423 456 789', '02 8765 4321'],
  ['David', 'Kim', 'david.kim@example.com', '0434 567 890', ''],
  ['Grace', "O'Sullivan", 'grace.osullivan@example.com', '', '07 3456 7890'],
];

function buildWorkbookBlob(rows) {
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Contacts');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** A blank spreadsheet with just the recognised headers, ready to fill in. */
export function buildTemplateBlob() {
  return buildWorkbookBlob([]);
}

/** The template headers plus a few fictional example rows. */
export function buildSampleDataBlob() {
  return buildWorkbookBlob(SAMPLE_ROWS);
}
