# qrgen

Turn a spreadsheet of people into stylish, scannable contact QR codes.

Upload an Excel or CSV file of names, email addresses and phone numbers, and qrgen
generates a QR code for each person. Scanning one with a phone camera offers to save that
person straight to the contacts app. Download codes individually as SVG or PNG, or grab
the whole set as a zip.

**Use it at [qrgen.noradz.io](https://qrgen.noradz.io/)** — there is
nothing to install.

## Your data never leaves your browser

qrgen has no server and no backend. Your spreadsheet is read locally by your own browser
and is never uploaded anywhere. Once the page has loaded you could disconnect from the
internet and it would still work.

## Usage

1. Open the site and drop in an `.xlsx`, `.xls` or `.csv` file.
2. Check the detected columns. qrgen guesses which column is which from the headers; if it
   guesses wrong, correct it with the dropdowns.
3. Pick a style, set the foreground and background colours if you want to match a brand
   palette, and choose whether each code carries a caption.
4. Download the codes individually, or all at once as a zip.

### Captions

By default each code is exported with the person's name, email address and phone number
printed beneath it — which is usually what makes a printed badge or table card useful. Turn
the caption off and you get the bare code instead. The setting applies to the downloaded
files, not just the on-screen preview.

One caveat for SVG: text in an SVG renders in whatever font the application opening it has
available, so a caption may look different in a vector editor than it does in the browser.
If you need the caption to look exactly as designed, use the PNG.

### About the colours

qrgen won't let you make a code that can't be scanned. Colours need enough contrast
between foreground and background, and the foreground has to be the darker of the two —
light-on-dark codes fail on a lot of scanners no matter how striking they look. If a
combination is too low-contrast it's rejected with an explanation; if it's borderline
you'll get a caution but it will still apply.

### Columns

The first row of the sheet is treated as headers. qrgen looks for these fields and
recognises most common spellings of each:

| Field | Headers it recognises |
| --- | --- |
| First name | First Name, First, Given Name, Forename |
| Surname | Surname, Last Name, Family Name |
| Email address | Email, Email Address, Mail |
| Mobile phone | Mobile, Mobile Number, Cell, Cell Phone |
| Work phone | Phone, Work Phone, Telephone, Office Phone, Landline |

Anything it doesn't recognise can be mapped by hand. A row needs **a name** and **at least
one way to contact the person** to produce a code; rows missing either are listed and
skipped rather than silently dropped.

## Output

Codes encode a **vCard 3.0**, the contact format iOS and Android both understand. Each code
is available as SVG (vector, for print) or PNG (raster, for screens and documents).

## Running it locally

Clone the repo and serve the folder over HTTP — opening `index.html` directly from the
filesystem will not work, because browsers block ES modules on `file://` URLs.

```sh
git clone https://github.com/Peytonizer/qrgen.git
cd qrgen
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

There is no build step and no dependencies to install. The libraries qrgen uses are
committed in `vendor/` — see `vendor/README.md` for versions and licences — and its
typefaces are self-hosted in `fonts/`, see `fonts/README.md`.

## Licence

MIT — see [LICENSE](LICENSE).

## Built with

- [SheetJS](https://sheetjs.com/) — reads the Excel and CSV files
- [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) — renders the codes
- [JSZip](https://stuk.github.io/jszip/) — builds the download archive
- [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque), [IBM Plex Sans and IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Sans) — the interface's typefaces, self-hosted rather than loaded from Google Fonts
