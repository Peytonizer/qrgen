# Changelog

One line per meaningful change. Newest first.

## Unreleased

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
