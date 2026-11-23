// Details Wera learns from a form the user moved on from: what the form
// asked that the user's application details lacked, as the user entered
// it. Self-identification is kept in the dashboard's own values; yes/no
// questions as "yes" or "no". Nothing already in the details is replaced.
import { SELF_ID, selfIdValue } from './selfId';
import type { Applicant, ApplicantKey, FieldPurpose } from './types';

/** Yes/no details: kept as "yes" or "no", whatever words the form used. */
const YES_NO = new Set<FieldPurpose>(['authorized_to_work', 'needs_sponsorship', 'willing_to_relocate', 'willing_to_travel', 'over_18']);

/**
 * Purposes that are not one detail each (a full name, a location), that
 * belong to one application (a start date, today's date), or that are
 * not details at all.
 */
const NOT_DETAILS = new Set<FieldPurpose>(['start_date', 'today', 'full_name', 'authorized_no_sponsorship', 'location', 'resume', 'cover_letter',
  'question', 'consent', 'phone_type', 'phone_code', 'skills']);

/** Whether a purpose can be an application detail (open answers, files and consents never are). */
export const detailPurpose = (purpose: FieldPurpose | null): purpose is FieldPurpose => !!purpose && !NOT_DETAILS.has(purpose);

/** Whether a field's purpose is one application detail Wera keeps. */
function isDetail(purpose: FieldPurpose | null, applicant: Applicant): purpose is ApplicantKey {
  return detailPurpose(purpose) && purpose in applicant;
}

/** Normalizes a form value for one application detail; null when the purpose is not a stored detail or the value doesn't fit. */
export function normalizeDetailValue(purpose: FieldPurpose | null, applicant: Applicant, value: string): { key: ApplicantKey; value: string } | null {
  if (!isDetail(purpose, applicant)) return null;
  let v = value.trim();
  if (SELF_ID.has(purpose)) v = selfIdValue(purpose, v);
  else if (YES_NO.has(purpose)) v = /^yes\b/i.test(v) ? 'yes' : /^no\b/i.test(v) ? 'no' : '';
  if (!v || v.length > 300) return null;
  return { key: purpose, value: v };
}

/** A correction the person made to a detail Wera filled, when it differs from their saved details. */
export function detailCorrection(applicant: Applicant, purpose: FieldPurpose | null, value: string): { key: ApplicantKey; from: string; to: string } | null {
  const norm = normalizeDetailValue(purpose, applicant, value);
  if (!norm) return null;
  const from = (applicant[norm.key] ?? '').trim();
  if (from.toLowerCase() === norm.value.toLowerCase()) return null;
  return { key: norm.key, from, to: norm.value };
}

/** The details worth saving from what a form held: only blanks, each as Wera stores it. */
export function learnedDetails(applicant: Applicant, entries: { purpose: FieldPurpose | null; value: string }[]): Partial<Applicant> {
  const out: Partial<Record<ApplicantKey, string>> = {};
  for (const { purpose, value } of entries.slice(0, 120)) {
    const norm = normalizeDetailValue(purpose, applicant, value);
    if (!norm || (applicant[norm.key] ?? '').trim() || out[norm.key]) continue;
    out[norm.key] = norm.value;
  }
  return out;
}
