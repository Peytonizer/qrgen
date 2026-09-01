# Vendored dependencies

Libraries are vendored here rather than loaded from a CDN, so a CDN outage or URL change
can't break the live site. Each entry records the exact version, licence and source so it
can be reproduced or updated.

| File | Library | Version | Licence | Source |
|---|---|---|---|---|
| `xlsx.full.min.js` | [SheetJS Community Edition](https://sheetjs.com/) | 0.18.5 | Apache-2.0 | `https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js` |
| `qr-code-styling.js` | [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) | 1.9.2 | MIT | `https://cdn.jsdelivr.net/npm/qr-code-styling@1.9.2/lib/qr-code-styling.js` |

Apache-2.0 and MIT both permit redistribution. `qr-code-styling.js` attaches itself as
the global `QRCodeStyling` (UMD build); its published `lib/` bundle is already minified,
hence the file name has no separate `.min` suffix despite the content being minified.
