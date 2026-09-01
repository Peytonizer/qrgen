# Changelog

One line per meaningful change. Newest first.

## Unreleased

- Delivered the dark staging room visual direction (build step 8): self-hosted Bricolage
  Grotesque, IBM Plex Sans and IBM Plex Mono (SIL OFL, `fonts/`, latin subset only — see
  `fonts/README.md`) and rebuilt `css/style.css` around SPEC.md's exact colour tokens and
  typography pairing. The Style step's preview is now the intended hero card + filmstrip
  (one large card for the first valid row, smaller cards for the rest) instead of a uniform
  grid, and gained an always-visible contrast readout alongside the existing caution/blocked
  messaging. Added a loading state while a file is being read, an empty state on the Style
  step when no rows are valid, and `:focus-visible` styling across the drop zone, step rail,
  mapping selects, preset tiles, colour wells and every button. Verified in-browser: fonts
  render (not a silent fallback), the hero card reads as "an object on a table" per the
  brief, and — since real window resizing isn't available in this sandbox — responsive
  behaviour at 390px verified via an iframe sized to that width, confirming the step rail
  wraps to two rows with connecting lines dropped, and both the Columns and Style steps stay
  a single unbroken column with no horizontal overflow.
- Added downloads (build step 7): `js/download.js` builds each card's SVG and PNG at
  1000px (via `qr-code-styling`'s own `getRawData`, composited with `caption.js` when
  captions are on), vendors JSZip 3.10.1 for the "download all" archive, and slugs
  filenames per SPEC.md — lowercase, punctuation to hyphens, `-2`/`-3` for duplicate names,
  `contact-{n}` for a name with no usable slug. The Download step now has a real per-person
  SVG/PNG button row and a "Download all (.zip)" button; both build their blobs on click
  rather than eagerly, since regenerating every card on every style change would be wasted
  work. Verified the blob-building logic directly (correct MIME types, PNG width exactly
  1000px with height growing for a wrapped caption, the comma in "Smith, Jr" intact, the
  zip's contents and duplicate-name filenames all correct) without exercising the actual
  download buttons, to avoid saving test files into a real Downloads folder.
- Added captions (build step 6): `js/caption.js` composites the person's name, email and
  phone beneath the QR for both export paths — an offscreen canvas for PNG, an outer `<svg>`
  wrapping the QR's own for SVG — so a caption is never preview-only styling. The Style step
  gained the on/off toggle (on by default), and the live preview now shows the actual
  composited output when captions are on, not a CSS approximation. Verified in-browser
  against the fixture's specific edge cases: "Bartholomew Fanshawe-Wallington" shrinks then
  wraps to two lines without clipping, the comma in "Smith, Jr" survives XML escaping intact
  (a deliberately different escaper from the vCard one, which would have corrupted it), "Zoë"
  survives to a well-formed, DOMParser-validated SVG with a UTF-8 XML declaration, and the
  toggle off reverts to the exact bare-code output from build step 5. Also spot-checked the
  PNG canvas path composites to a correctly-sized, non-throwing canvas.
- Added QR generation and styling (build step 5): `js/qr.js` wraps vendored `qr-code-styling`
  1.9.2 with the four exact presets from SPEC.md and the two colour guardrails (foreground
  must be darker than background; contrast ratio banded at 4:1/7:1). The Style step now
  renders a real preset picker, foreground/background colour wells, and a live preview grid
  — one QR per valid row, regenerating on every preset or colour change. A blocked colour is
  rejected and the well reverts; a caution-band colour applies with a visible warning.
  Resolved with Matt: the Gradient preset has two foreground stops, so the single foreground
  well disables itself rather than reinterpreting a two-stop gradient. Verified
  `checkColours` against the spec's known pairs (black/white ~21:1 ok, `#767676`/white ~4.5:1
  caution, white-on-black blocked by rule 1 despite 21:1) before wiring it up, and confirmed
  live in-browser that a blocked colour reverts with a message and a caution colour applies
  with one. Also did a lightweight automated sanity check — decoding a rendered QR back with
  a third-party JS decoder — which round-tripped an ASCII vCard byte-for-byte; it hit a known
  decoder limitation with non-ASCII content (any accented character decodes as empty rather
  than garbled) unrelated to our output, so it doesn't stand in for the real-phone scan test
  SPEC.md calls for, which is still outstanding — the Zoë row is the one case this check
  couldn't clear, so it's worth scanning first.
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
