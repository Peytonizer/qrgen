// Builds an RFC 2426 vCard 3.0 string from a row's mapped fields. See
// SPEC.md, "vCard 3.0 output", for the exact format and escaping rules.
//
// Lines are joined with CRLF and deliberately NOT folded at 75 octets —
// several scanners handle folded lines badly, and QR capacity isn't a
// constraint at this payload size. Unfolded output is what almost every
// vCard QR in the wild uses.

/**
 * Escapes a value for insertion into a vCard property, per RFC 2426:
 * backslash, then semicolon, comma, and newline — in that order, or the
 * earlier escapes get escaped again by the later ones.
 */
function escapeVCardValue(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Builds a vCard 3.0 string from a row's mapped, trimmed fields (as produced
 * by columns.js's `validateRows`). EMAIL and TEL lines are omitted entirely
 * when their field is empty. N and FN are always present — the validation
 * rule guarantees at least one name part exists by the time a row gets here
 * — with FN built from whichever name parts exist, collapsing the extra
 * space when one is missing.
 */
export function buildVCard({ firstName, lastName, email, mobile, workPhone }) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];

  const n = [lastName, firstName].map(escapeVCardValue).join(';');
  lines.push(`N:${n};;;`);

  const fn = [firstName, lastName].filter(Boolean).join(' ');
  lines.push(`FN:${escapeVCardValue(fn)}`);

  if (email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardValue(email)}`);
  if (mobile) lines.push(`TEL;TYPE=CELL:${escapeVCardValue(mobile)}`);
  if (workPhone) lines.push(`TEL;TYPE=WORK,VOICE:${escapeVCardValue(workPhone)}`);

  lines.push('END:VCARD');

  return lines.join('\r\n');
}
