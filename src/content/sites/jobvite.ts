// Jobvite: the resume and cover letter inputs sit in popups at the end of
// the page, with nothing to say which is which. They come in the order of
// the page's Add buttons, and each button says what it adds. Some employers
// (e.g. Nutanix) also show a Data Consent step for country and language
// before the application form.
import { collectFields, isHidden, type Field } from '../fields';
import type { Site } from './index';

function attachment(f: Field): string {
  const at = /^file-input-(\d+)$/.exec(f.el.id)?.[1];
  return at == null ? '' : (f.el.ownerDocument.querySelectorAll('[jv-add-attachment]')[Number(at)]?.getAttribute('attachment-label') ?? '');
}

const CONSENT_HEADING = /\b(data consent|privacy notice|gdpr|candidate privacy|data protection)\b/i;

function gate(doc: Document): string | null {
  const consentRoot = doc.querySelector('.jv-consent, [jv-consent], [ng-controller*="Consent" i]');
  const headings = [...doc.querySelectorAll('h1, h2, h3, legend, [role="heading"]')]
    .filter((h) => !isHidden(h))
    .map((h) => h.textContent ?? '')
    .join(' ');
  if (!consentRoot && !CONSENT_HEADING.test(headings)) return null;
  const fields = collectFields(doc, undefined, true);
  // Once the full application form is on screen, Jobvite is past the consent gate.
  if (fields.some((f) => f.kind === 'file' || /first\s*name|last\s*name|resume/i.test(f.label))) return null;
  const hasLocationOrLang = fields.some((f) => /\b(country|location|language)\b/i.test(f.label));
  return hasLocationOrLang
    ? 'Jobvite asks for your location, language and data consent before the application. Press Autofill to fill what Wera knows, accept the terms yourself, then continue to the form.'
    : 'Jobvite asks you to accept its data consent before the application. Accept it here, and Wera fills the application on the next page.';
}

export const jobvite: Site = {
  name: 'Jobvite',
  matches: (doc) => /^jobs\.jobvite\.com$/i.test(doc.location?.hostname ?? ''),
  purpose(f) {
    if (f.kind !== 'file') return undefined;
    const says = attachment(f);
    return /resume|\bcv\b/i.test(says) ? 'resume' : /cover/i.test(says) ? 'cover_letter' : undefined;
  },
  gate,
};
