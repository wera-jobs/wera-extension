// A page that stands between the user and the application form: an account
// wall, a data-consent or privacy step, or a location/language picker.
// Sites that word it their own way have a rule of their own (see sites/workday.ts,
// sites/jobvite.ts).
import type { FieldPurpose } from '../shared/types';
import { classify } from './classify';
import { ENTRY_PURPOSES } from './entries';
import { collectFields, isHidden } from './fields';
import { siteFor } from './sites';

const SIGN_IN = /^(sign|log) ?in\b/i;
const NEW_ACCOUNT = /^(create|register|sign ?up)\b/i;
// A few boxes are a sign-in form; more than that is the application itself.
const MOST_SIGN_IN_BOXES = 2;
const MOST_PRE_FORM_FIELDS = 3;

const ASK = 'This site wants an account first. Sign in or create one here, and Wera fills the application when it shows.';
const CONSENT_WITH_SAFE = 'This site asks for your location, language and data consent before the application. Press Autofill to fill what Wera knows, review and accept the terms yourself, then continue to the form.';
const CONSENT_ONLY = 'This site asks you to review its data consent or terms before the application. Accept them here, and Wera fills the application on the next page.';
const LOCATION_ONLY = 'This site asks for your location or language before the application. Press Autofill to fill it from your details, then continue to the form.';

const ACCEPT_BTN = /^(accept|i accept|agree|i agree|accept (and|&) continue|agree (and|&) continue|confirm|acknowledge|continue|next|proceed)\b/i;
const CONSENT_TEXT = /\b(data consent|privacy notice|privacy policy|candidate privacy|data privacy|data protection|terms (and|&) conditions|gdpr|applicant consent|consent agreement)\b/i;
const SAFE_PRE_FORM = new Set<FieldPurpose>(['country', 'location', 'languages']);
const CORE_APPLICATION = new Set<FieldPurpose>(['first_name', 'last_name', 'full_name', 'phone', 'resume', 'cover_letter', ...ENTRY_PURPOSES]);

/** Whether the page is a sign-in or create-account gate before the application. */
export function accountWall(doc: Document): string | null {
  const password = [...doc.querySelectorAll('input[type="password"]')].some((i) => !isHidden(i));
  const words = [...doc.querySelectorAll<HTMLElement>('button, a, [role="button"], input[type="submit"]')]
    .filter((c) => !isHidden(c)).map((c) => (c.textContent || (c as HTMLInputElement).value || '').trim());
  if (!password && !(words.some((w) => SIGN_IN.test(w)) && words.some((w) => NEW_ACCOUNT.test(w)))) return null;
  return collectFields(doc, undefined, true).filter((f) => f.kind !== 'file').length > MOST_SIGN_IN_BOXES ? null : ASK;
}

/** Whether the page is a pre-form consent, privacy, or location/language step. */
export function consentWall(doc: Document): string | null {
  const fields = collectFields(doc, undefined, true);
  const purposes = fields.map(classify);
  if (purposes.some((p) => p !== null && CORE_APPLICATION.has(p))) return null;
  const nonConsent = purposes.filter((p) => p !== 'consent');
  if (nonConsent.length > MOST_PRE_FORM_FIELDS) return null;
  const safeCount = nonConsent.filter((p) => p !== null && SAFE_PRE_FORM.has(p)).length;
  const hasConsentField = purposes.includes('consent');
  const hasAction = [...doc.querySelectorAll<HTMLElement>('button, a, [role="button"], input[type="submit"], input[type="button"]')]
    .filter((c) => !isHidden(c))
    .some((c) => ACCEPT_BTN.test((c.textContent || (c as HTMLInputElement).value || '').replace(/\s+/g, ' ').trim()));
  const headingText = [...doc.querySelectorAll('h1, h2, h3, legend, [role="heading"]')]
    .filter((h) => !isHidden(h))
    .map((h) => h.textContent ?? '')
    .join(' ');
  const bodySample = (doc.body?.textContent ?? '').slice(0, 4000);
  const hasConsentCopy = CONSENT_TEXT.test(headingText) || (hasConsentField && CONSENT_TEXT.test(bodySample)) || (hasAction && CONSENT_TEXT.test(bodySample) && fields.length > 0);
  if ((hasConsentField || hasConsentCopy) && (hasAction || hasConsentField)) {
    return safeCount > 0 ? CONSENT_WITH_SAFE : CONSENT_ONLY;
  }
  if (safeCount > 0 && safeCount === nonConsent.length && hasAction) {
    return LOCATION_ONLY;
  }
  return null;
}

/** What the page wants first, if anything. */
export function gateOf(doc: Document): string | null {
  return siteFor(doc)?.gate?.(doc) ?? accountWall(doc) ?? consentWall(doc);
}
