// LinkedIn Easy Apply. Runs inside the Easy Apply modal dialog over a
// job listing. Steps advance via "Next" and "Review" buttons with
// aria-labels ("Continue to next step", "Review your application"),
// and a progress bar shows how far along the modal is.
import type { FieldPurpose } from '../../shared/types';
import type { Field } from '../fields';
import type { Site, Step } from './index';

const HOST = /(^|\.)linkedin\.com$/i;

function modal(doc: Document): HTMLElement | null {
  return doc.querySelector<HTMLElement>('.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"], [role="dialog"].artdeco-modal');
}

const NAMES: [RegExp, FieldPurpose][] = [
  [/phoneNumber-nationalNumber|phone-number/i, 'phone'],
  [/phoneNumber-country/i, 'phone_code'],
  [/emailAddress|email-address/i, 'email'],
  [/firstName|first-name/i, 'first_name'],
  [/lastName|last-name/i, 'last_name'],
  [/location-geo|city-input/i, 'city'],
  [/jobs-document-upload-file-input/i, 'resume'],
];

function purpose(f: Field): FieldPurpose | null | undefined {
  const key = `${f.el.id} ${f.el.getAttribute('name') ?? ''} ${f.el.className ?? ''}`;
  for (const [re, p] of NAMES) if (re.test(key)) return p;
  return undefined;
}

function next(doc: Document): HTMLElement | null {
  const root = modal(doc) ?? doc;
  const btn = root.querySelector<HTMLElement>(
    'button[data-easy-apply-next-button], button[aria-label="Continue to next step"], button[aria-label="Review your application"]',
  );
  if (btn && !(btn as HTMLButtonElement).disabled) return btn;
  return null;
}

function step(doc: Document): Step | null {
  const root = modal(doc);
  if (!root) return null;
  const bar = root.querySelector<HTMLProgressElement>('progress[max], [role="progressbar"][aria-valuenow]');
  const heading = (root.querySelector('h3, h2')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (bar) {
    const val = Number(bar.getAttribute('value') ?? bar.getAttribute('aria-valuenow') ?? 0);
    const max = Number(bar.getAttribute('max') ?? bar.getAttribute('aria-valuemax') ?? 100);
    if (max > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((val / max) * 100)));
      return { name: heading || `${pct}%`, index: Math.max(1, Math.round(pct / 25)), total: 4 };
    }
  }
  return heading ? { name: heading, index: 1, total: 1 } : null;
}

export const linkedin: Site = {
  name: 'LinkedIn',
  matches: (doc) => HOST.test(doc.location?.hostname ?? '') && !!modal(doc),
  purpose,
  next,
  step,
  pace: 80,
};
