// Ten more applicant tracking systems, benchmarked against Jobright (#239).
// Recruitee, Pinpoint and Dover were read live on Nov 28: Wera's general
// rules read every field of their forms, so these entries name the system
// (for the panel, the diagnostics and the submit watcher) and add what
// differs. The rest are recognized by their hosts or their markup; their
// forms sit behind a sign-in and are read by the general rules once open.
import type { Site } from './index';

const host = (re: RegExp) => (doc: Document) => re.test(doc.location?.hostname ?? '');

/** A page that wants the person signed in before it shows its form. */
const signInFirst = (doc: Document): string | null => {
  const text = (doc.body?.innerText ?? doc.body?.textContent ?? '').slice(0, 4000);
  const fields = doc.querySelectorAll('input:not([type="hidden"]), select, textarea').length;
  return fields <= 3 && /\b(sign in|log in|create (an )?account)\b.{0,80}\b(apply|application|continue)\b/i.test(text)
    ? 'Sign in or create an account on this site first; Wera fills the application once it shows.' : null;
};

export const recruitee: Site = { name: 'Recruitee', matches: (doc) => host(/(^|\.)recruitee\.com$/i)(doc) || !!doc.querySelector('[data-testid^="careers-"], link[href*="recruitee"]') };
export const pinpoint: Site = { name: 'Pinpoint', matches: host(/(^|\.)pinpointhq\.com$/i) };
export const dover: Site = { name: 'Dover', matches: host(/(^|\.)dover\.(com|io)$/i) };
export const gem: Site = { name: 'Gem', matches: host(/^jobs\.gem\.com$/i) };
export const dayforce: Site = { name: 'Dayforce', matches: host(/(^|\.)dayforcehcm\.com$/i), gate: signInFirst };
export const paycom: Site = { name: 'Paycom', matches: host(/(^|\.)paycomonline\.(net|com)$/i), gate: signInFirst };
export const brassring: Site = { name: 'BrassRing', matches: host(/(^|\.)brassring\.com$/i), gate: signInFirst, pace: 80 };
export const eightfold: Site = { name: 'Eightfold', matches: (doc) => host(/(^|\.)eightfold\.ai$/i)(doc) || !!doc.querySelector('#pcs-body-container, [class*="eightfold" i]') };
export const phenom: Site = { name: 'Phenom', matches: (doc) => !!doc.querySelector('[data-ph-at-id], [data-ph-id]'), gate: signInFirst };
export const avature: Site = { name: 'Avature', matches: (doc) => host(/(^|\.)avature\.net$/i)(doc) || !!doc.querySelector('meta[name="generator"][content*="Avature" i]'), gate: signInFirst };

export const MORE_SITES: Site[] = [recruitee, pinpoint, dover, gem, dayforce, paycom, brassring, eightfold, phenom, avature];
