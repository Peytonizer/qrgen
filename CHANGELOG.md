# Changelog

One line per meaningful change. Newest first.

## Unreleased

- Added `js/vcard.js`, building a vCard 3.0 string per RFC 2426 from a row's mapped fields
  (build step 4): CRLF line joins, no 75-octet folding, and escaping applied in the order
  the RFC requires — backslash, then semicolon, comma, newline — so the escapes can't
  escape each other. Verified against all 10 valid fixture rows, including the comma in
  "Smith, Jr" and the "ë" in "Zoë Fitzgerald-Byrne" surviving intact. **Still needs a
  real-phone scan test** (iPhone and Android) once build step 5 produces an actual QR code
  to scan — a vCard that looks correct on inspection and fails to import on a phone is
  called out in SPEC.md as the most expensive bug in this project to find late.
- Added the step rail and column mapping (build step 3): a four-step nav (File, Columns,
  Style, Download) where step 1 gates step 2, then all four are freely reachable once a
  file is parsed. Columns auto-detects the five fields from the header synonym lists in
  `js/columns.js`, shows an override `<select>` per field, and splits rows into a valid
  table and a greyed "Skipped rows" table with a reason each — re-mapping re-validates
  live, without re-reading the file. Style and Download are placeholders until their own
  build steps. Verified against the fixture: auto-detection gets all five columns right
  and the split matches the spec exactly (10 valid, 2 skipped).
- Parse an uploaded spreadsheet into a raw preview table (build step 2): a drop zone plus
  file picker feeds `.xlsx`/`.xls`/`.csv` through vendored SheetJS 0.18.5 into row objects,
  dumped straight into an HTML table with no mapping or QR generation yet. Blank rows are
  filtered explicitly, since a row whose cells are all present-but-empty isn't caught by
  SheetJS's own `blankrows` option. CSV is decoded as UTF-8 text before parsing rather than
  read as raw bytes — otherwise non-ASCII characters (e.g. "Zoë") get mis-decoded when the
  file has no BOM. Verified against the fixture data that a leading zero in a phone number
  survives the `.xlsx` round trip via `raw: false`.
- Settled the interface as a four-step guided flow after mocking up two directions. The
  skipped-row review sits inside the column-mapping step rather than in a step of its own,
  so correcting a mapping visibly shrinks the list of rows that can't be used.
- Added an optional caption beneath each code, on by default. It composites into the
  exported SVG and PNG rather than being preview-only styling.
- Added the MIT licence.
- Brought foreground and background colour pickers into the v1 scope, guarded by a contrast
  floor and a rule that the foreground must be darker than the background — a colour picker
  is otherwise the easiest way to produce a code that looks good and won't scan.
- Set up the project: README, changelog, and a `.gitignore` that blocks spreadsheet files
  so contact data can't be committed to this public repo by accident.
