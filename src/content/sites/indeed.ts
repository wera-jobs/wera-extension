// Indeed Apply (smartapply.indeed.com / apply.indeed.com). Multi-step
// hosted flow with a progress bar, Continue button, and standardized
// input-first-name / input-last-name / input-phone-number ids.
import type { FieldPurpose } from '../../shared/types';
import type { Field } from '../fields';
import type { Site, Step } from './index';

const HOST = /(^|\.)(smartapply|apply)\.indeed\.com$/i;

const NAMES: [RegExp, FieldPurpose][] = [
  [/input-first-name|firstName/i, 'first_name'],
  [/input-last-name|lastName/i, 'last_name'],
  [/input-email|emailAddress/i, 'email'],
  [/input-phone-number|phoneNumber/i, 'phone'],
  [/input-location\.city|location\.city/i, 'city'],
  [/input-location\.state|location\.state/i, 'state'],
  [/input-location\.postal|postalCode/i, 'postal_code'],
  [/ia-FilePicker|resume-upload/i, 'resume'],
];

function purpose(f: Field): FieldPurpose | null | undefined {
  const key = `${f.el.id} ${f.el.getAttribute('name') ?? ''} ${f.el.getAttribute('data-testid') ?? ''}`;
  for (const [re, p] of NAMES) if (re.test(key)) return p;
  return undefined;
}

function next(doc: Document): HTMLElement | null {
  const btn = doc.querySelector<HTMLElement>(
    'button[data-testid="continue-button"], button.ia-continueButton, button[data-testid="ia-continue-button"]',
  );
  if (btn && !(btn as HTMLButtonElement).disabled && !/submit/i.test(btn.textContent ?? '')) return btn;
  return null;
}

function step(doc: Document): Step | null {
  const heading = (doc.querySelector('h1.ia-BasePage-heading, [data-testid="ia-page-heading"], h1')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const bar = doc.querySelector<HTMLElement>('[role="progressbar"][aria-valuenow], .ia-ProgressBar progress');
  if (bar) {
    const val = Number(bar.getAttribute('aria-valuenow') ?? bar.getAttribute('value') ?? 0);
    const max = Number(bar.getAttribute('aria-valuemax') ?? bar.getAttribute('max') ?? 100);
    if (max > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((val / max) * 100)));
      return { name: heading || `${pct}%`, index: Math.max(1, Math.round(pct / 25)), total: 4 };
    }
  }
  return heading ? { name: heading, index: 1, total: 1 } : null;
}

export const indeed: Site = {
  name: 'Indeed',
  matches: (doc) => HOST.test(doc.location?.hostname ?? '') || !!doc.querySelector('.ia-BasePage, [data-testid="ia-page-heading"]'),
  purpose,
  next,
  step,
  pace: 80,
};
