# Self-hosted fonts

Self-hosted rather than linked from Google Fonts, for the same reason libraries are
vendored in `vendor/` rather than loaded from a CDN — see `vendor/README.md`. Only the
`latin` subset was pulled (covers Basic Latin plus Latin-1 Supplement, e.g. "Zoë"); the
`@font-face` fallback stacks in `css/style.css` cover any character outside it.

| File | Family | Weight | Licence | Source |
|---|---|---|---|---|
| `bricolage-grotesque-variable.woff2` | [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) | Variable (400–700) | SIL OFL 1.1 | fonts.gstatic.com, via Google Fonts `css2` API |
| `ibm-plex-sans-variable.woff2` | [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) | Variable (400–600) | SIL OFL 1.1 | fonts.gstatic.com, via Google Fonts `css2` API |
| `ibm-plex-mono-400.woff2` | [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) | 400 (static family, no variable axis) | SIL OFL 1.1 | fonts.gstatic.com, via Google Fonts `css2` API |

The Bricolage Grotesque and IBM Plex Sans files are true variable fonts — Google serves
the same file for every requested static weight in the `latin` subset, so one file each
covers their full weight range via `font-weight: <min> <max>` in the `@font-face` rule
rather than needing a separate file per weight. IBM Plex Mono is a static family; only
400 (regular) is used, for labels, hex values and counts per SPEC.md's typography.

SIL OFL 1.1 permits redistribution, including bundling with an application.
