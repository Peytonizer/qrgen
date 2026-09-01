// Header auto-detection, the mapping model, and per-row validity. Kept as
// pure functions with no DOM access, per SPEC.md's proposed layout — app.js
// renders the mapping selects and row-review table from what this returns.

// Order matters: for each header, fields are checked in this order and the
// first list the header's normalised form appears in wins. Listing mobile
// before workPhone means a lone ambiguous "Phone" column falls to work
// phone, leaving a dedicated "Mobile" column free to claim mobile. See
// SPEC.md, "Header auto-detection", for the exact synonym lists.
const FIELD_SYNONYMS = [
  ['firstName', ['firstname', 'first', 'givenname', 'given', 'forename', 'fname', 'christianname']],
  ['lastName', ['surname', 'lastname', 'last', 'familyname', 'family', 'lname']],
  ['email', ['email', 'emailaddress', 'mail', 'workemail', 'emailwork']],
  ['mobile', ['mobile', 'mobilephone', 'mobileno', 'mobilenumber', 'cell', 'cellphone', 'cellular']],
  ['workPhone', ['workphone', 'phone', 'telephone', 'tel', 'officephone', 'landline', 'businessphone', 'phonenumber']],
];

export const FIELDS = FIELD_SYNONYMS.map(([field]) => field);

export const FIELD_LABELS = {
  firstName: 'First name',
  lastName: 'Surname',
  email: 'Email address',
  mobile: 'Mobile phone',
  workPhone: 'Work/other phone',
};

/** Lowercases and strips every non-alphanumeric character. */
function normalizeHeader(header) {
  return String(header).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Guesses which column is which field from the header row. Returns
 * `{ firstName: header|null, lastName: header|null, email: ..., mobile: ..., workPhone: ... }`.
 * A header claims at most one field (the first synonym list it matches,
 * checked in `FIELD_SYNONYMS` order), and a field is claimed by at most one
 * header (the first header that matches it wins) — so the same column is
 * never assigned to two fields.
 */
export function detectMapping(headers) {
  const mapping = Object.fromEntries(FIELDS.map((field) => [field, null]));
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    for (const [field, synonyms] of FIELD_SYNONYMS) {
      if (mapping[field] === null && synonyms.includes(normalized)) {
        mapping[field] = header;
        break;
      }
    }
  }
  return mapping;
}

/**
 * Applies `mapping` (field → header name, or null) to `rows` and splits them
 * into valid and skipped, per the validation rule in SPEC.md: a usable row
 * needs at least one of first name or surname, AND at least one of email,
 * mobile or work phone.
 *
 * Each entry carries `index` (the row's position in `rows`, stable across
 * re-mapping) and `fields` — the row's values under the mapping, trimmed.
 * Skipped entries also carry a human-readable `reason`.
 */
export function validateRows(rows, mapping) {
  const valid = [];
  const skipped = [];

  rows.forEach((row, index) => {
    const fields = Object.fromEntries(
      FIELDS.map((field) => [field, mapping[field] ? String(row[mapping[field]] ?? '').trim() : ''])
    );

    const hasName = fields.firstName !== '' || fields.lastName !== '';
    const hasContact = fields.email !== '' || fields.mobile !== '' || fields.workPhone !== '';

    if (hasName && hasContact) {
      valid.push({ index, fields });
      return;
    }

    let reason;
    if (!hasName && !hasContact) {
      reason = 'Missing a name and a way to contact them';
    } else if (!hasName) {
      reason = 'Missing a name';
    } else {
      reason = 'Missing an email address or phone number';
    }
    skipped.push({ index, fields, reason });
  });

  return { valid, skipped };
}
