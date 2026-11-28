// Yes/no questions the user's own data settles, answered without the AI:
// "a minimum of 7 years of experience?" against their years, "are you
// based in / able to work from <city>?" against where they live and how
// they want to work. Only what follows for certain is answered; anything
// else stays with the AI's careful rules (a guessed "no" can end an
// application, a guessed "yes" is a false claim).
import type { Applicant, Profile } from '../shared/types';
import { norm, US_NAMES } from './places';

export interface Derived {
  value: 'Yes' | 'No';
  /** Where it came from, as the panel shows it. */
  why: string;
}

/** The fewest years a question asks for ("a minimum of 7 years", "5+ years", "at least three years"), or null. */
export function yearsAsked(q: string): number | null {
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15 };
  const t = q.toLowerCase();
  const m = /(?:minimum of|at least|more than|over|min\.?)\s+(\d{1,2}|[a-z]+)\s*\+?\s*(?:\(\d+\)\s*)?(?:years?|yrs?)\b|\b(\d{1,2})\s*\+\s*(?:years?|yrs?)\b|\b(\d{1,2})\s*(?:or more|and above|plus)\s*(?:years?|yrs?)\b|\b(\d{1,2})\s*(?:years?|yrs?)\s*(?:or more|minimum|\+)/.exec(t);
  if (!m) return null;
  const raw = m[1] ?? m[2] ?? m[3] ?? m[4] ?? '';
  const n = /^\d+$/.test(raw) ? Number(raw) : words[raw] ?? NaN;
  return Number.isFinite(n) && n > 0 && n <= 40 ? n : null;
}

/** Years worked, from the details, else the resume's dated jobs (overlaps counted once). */
export function yearsWorked(a: Applicant | Profile, today = new Date()): number | null {
  const stated = Number.parseFloat(a.years_experience ?? '');
  if (Number.isFinite(stated) && stated >= 0) return stated;
  const jobs = (a as Profile).experience ?? [];
  const spans: [number, number][] = [];
  const month = (ym?: string) => (ym && /^\d{4}(-\d{2})?$/.test(ym) ? Number(ym.slice(0, 4)) * 12 + (ym.length === 7 ? Number(ym.slice(5, 7)) - 1 : 0) : null);
  const now = today.getFullYear() * 12 + today.getMonth();
  for (const j of jobs) {
    const s = month(j.start);
    const e = j.current ? now : month(j.end);
    if (s != null && e != null && e >= s) spans.push([s, e]);
  }
  if (!spans.length) return null;
  spans.sort((x, y) => x[0] - y[0]);
  let total = 0;
  let [cs, ce] = spans[0]!;
  for (const [s, e] of spans.slice(1)) {
    if (s <= ce) ce = Math.max(ce, e);
    else {
      total += ce - cs;
      [cs, ce] = [s, e];
    }
  }
  total += ce - cs;
  return Math.round((total / 12) * 10) / 10;
}

// Experience in general, not with one tool: then the whole career counts.
const GENERAL = /^(?:do|does) you have (?:a )?(?:minimum of |at least |more than |over )?[\w\s+()]*?(?:years?|yrs?)\b(?: of)? (?:(?:full[- ]time |relevant |professional |industry |work |working |post[- ]graduate |paid )*)(?:experience|work experience)(?: (?:building software|in software|as an? [\w\s-]+|in (?:a|an) [\w\s-]+ role|in the industry|in this field|working))?\s*\??$/i;

/** A place's words to compare ("San Francisco, CA" and "San Francisco, California" share "san francisco"). */
const city = (s: string) => norm(s.split(',')[0] ?? '');

/**
 * The answer the data settles for a yes/no question, or null. ctx.jobLocation
 * is where the job is; the question's own words come first.
 */
export function derivedAnswer(question: string, a: Applicant | Profile, ctx: { jobLocation?: string } = {}): Derived | null {
  const q = question.replace(/\s+/g, ' ').trim();
  const asked = yearsAsked(q);
  if (asked != null) {
    const have = yearsWorked(a);
    if (have == null) return null;
    // Fewer years in all than asked: fewer with any one tool too. A sure no.
    if (have < asked) return { value: 'No', why: `you have ${have} year${have === 1 ? '' : 's'} of experience` };
    // Enough years in all: a sure yes only when the question is about experience in general.
    if (GENERAL.test(q)) return { value: 'Yes', why: `you have ${have} years of experience` };
    return null;
  }
  const home = city(a.city ?? '');
  const job = ctx.jobLocation ?? '';
  // "Are you able to work from our San Francisco office three days a week?" / "commit to work from our offices…"
  if (/\b(work|commute|come in|be) (from|in|into|to) (our|the)\b.*\boffices?\b|\bcommit to (work(ing)? )?(from|in) (our|the) offices?|\bin[- ]office\b.*\b(days?|week)\b|\banchor days\b/i.test(q)) {
    const pref = (a.work_preference ?? '').toLowerCase();
    if (pref === 'remote') return null; // their call: they said they want remote
    const named = /\b(?:our|the) ([A-Z][a-zA-Z.]+(?: [A-Z][a-zA-Z.]+)*) office/.exec(question)?.[1] ?? '';
    const there = named && !/^(US|U\.S\.|United States)$/.test(named) ? norm(named) : city(job);
    if (home && there && (there.includes(home) || home.includes(there))) return { value: 'Yes', why: `you live in ${a.city} and want ${pref || 'office or hybrid'} work` };
    return null;
  }
  // "Are you currently located in / based in the US?"
  const located = /\b(?:currently )?(?:located|based|living|reside|residing) in (?:the )?([a-z .]+?)(?:\?|$| or | and |,)/i.exec(q);
  if (located && /^are you|^do you/i.test(q)) {
    const place = norm(located[1] ?? '');
    const country = norm(a.country ?? '');
    if (!place || !country) return null;
    const isUS = US_NAMES.includes(place) || place === 'us' || place === 'usa' || place === 'u s';
    if (isUS) return US_NAMES.includes(country) ? { value: 'Yes', why: `you live in ${a.country}` } : { value: 'No', why: `you live in ${a.country}` };
    if (place === country || (home && place === home)) return { value: 'Yes', why: `you live in ${[a.city, a.country].filter(Boolean).join(', ')}` };
    return null;
  }
  return null;
}
