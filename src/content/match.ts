// Matching a value to a list's choices the way a person would: by
// wording, then by meaning ("Male" is "Man", "I am not a protected
// veteran" is never "I am a protected veteran", "B.S." is a bachelor's,
// "Dallas, TX" is "Dallas, Texas, United States", 5 years is "3-5 years").
import { DECLINE, SELF_ID } from '../shared/selfId';
import type { FieldPurpose } from '../shared/types';
import type { Option } from './fields';
import { norm, US_NAMES, US_STATES } from './places';
import { alternatives, firstChoice } from './values';

// What the details' self-identification and education answers mean, as forms word them.
const MEANINGS: Partial<Record<FieldPurpose, [RegExp, RegExp][]>> = {
  gender: [
    [/^(male|man|m)$/, /^(male|man|men|cis ?(gender )?(male|man))\b|\bhe ?\/ ?him/],
    [/^(female|woman|f)$/, /^(female|woman|women|cis ?(gender )?(female|woman))\b|\bshe ?\/ ?her/],
    [/non.?binary|genderqueer|gender non/, /non.?binary|genderqueer|gender ?non|gender ?fluid|gender ?expansive/],
  ],
  sexual_orientation: [
    [/heterosexual|straight/, /heterosexual|straight/],
    [/gay|lesbian|homosexual/, /gay|lesbian|homosexual/],
    [/bisexual/, /bisexual/],
    [/asexual/, /asexual/],
    [/pansexual/, /pansexual/],
    [/queer/, /queer/],
  ],
  race: [
    [/black|african/, /black|african american/],
    [/^white/, /^white|caucasian/],
    [/^asian/, /^asian/],
    [/american indian|alaska/, /american indian|alaska(n)? native|native american|indigenous/],
    [/hawaiian|pacific/, /hawaiian|pacific islander/],
    [/two or more|multi/, /two or more|multi.?racial|multiple races|mixed/],
    [/hispanic|latin/, /hispanic|latin[oaxe]/],
  ],
  disability: [
    [/^no\b|do not have|don.?t have/, /^no\b|do not have|don.?t have|not have a disab/],
    [/^yes\b|have a disab/, /^yes\b|i have a disab|have (or have )?had a disab/],
  ],
};

const LEVELS: [string, RegExp][] = [
  ['doctorate', /\b(ph\.? ?d|doctor|doctorate|doctoral|d\.?phil|ed\.?d|j\.?d|m\.?d)\b/],
  ['master', /\b(master|masters|m\.? ?s\.?c?|m\.? ?a|mba|m\.?eng|meng|msn|mph|mfa|graduate degree)\b/],
  ['bachelor', /\b(bachelor|bachelors|b\.? ?s\.?c?|b\.? ?a|bba|b\.?eng|beng|bsn|b\.?tech|undergraduate|4.year)\b/],
  ['associate', /\b(associate|associates|a\.? ?s|a\.? ?a|adn|2.year)\b/],
  ['high_school', /high school|secondary|ged|diploma/],
];

// Degrees of one level are different degrees: a PhD is no M.D., a Master of Science no M.B.A.
const DEGREE_KINDS: [string, RegExp][] = [
  ['medicine', /\bm\.? ?d\b|\bmedicine\b/],
  ['pharmacy', /pharm/],
  ['law', /\bj\.? ?d\b|\bjuris\b|\bll\.?m\b|\blaw\b/],
  ['philosophy', /\bph\.? ?d\b|\bd\.?phil\b|\bphilosophy\b/],
  ['education', /\bed\.? ?d\b|\bm\.?ed\b|\bof education\b/],
  ['business', /\bm\.?b\.?a\b|\bb\.?b\.?a\b|\bbusiness\b/],
  ['nursing', /\bmsn\b|\bbsn\b|\badn\b|\bnursing\b/],
  ['fine arts', /\bm\.?f\.?a\b|\bb\.?f\.?a\b|\bfine arts\b/],
  ['public health', /\bm\.?p\.?h\b|\bpublic health\b/],
  ['engineering', /\bm\.?eng\b|\bb\.?eng\b|\bb\.?tech\b|\bof engineering\b/],
  ['science', /\b[mb]\.? ?s\.?c?\b|\bof science\b/],
  ['arts', /\b[mb]\.? ?a\b|\bof arts\b/],
];

const degreeKind = (text: string) => DEGREE_KINDS.find(([, re]) => re.test(text.toLowerCase().replace(/[’']/g, '')))?.[0] ?? '';

/**
 * The option that is this degree, among options of its level: the same
 * degree, else one that says only the level. A value that names no degree
 * takes a list's only one, but does not pick among several.
 */
function sameDegree(options: Option[], value: string): Option | null {
  const kind = degreeKind(value);
  const plain = options.find((o) => !degreeKind(o.label));
  if (kind) return options.find((o) => degreeKind(o.label) === kind) ?? plain ?? null;
  return plain ?? (options.length === 1 ? options[0]! : null);
}

/** A degree's level ("B.S. in Biology" is bachelor), '' when unclear. */
export function degreeLevel(text: string): string {
  const t = text.toLowerCase().replace(/[’']/g, '');
  return LEVELS.find(([, re]) => re.test(t))?.[0] ?? '';
}

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** A month's number (1-12) in "March", "Mar", "03" or "3"; 0 when it is not a month. */
function monthOf(s: string): number {
  const t = s.trim().toLowerCase();
  if (/^(0?[1-9]|1[0-2])$/.test(t)) return Number(t);
  const i = MONTH_NAMES.findIndex((m) => t.length >= 3 && (m === t || m.startsWith(t.slice(0, 3)) && /^[a-z]+\.?$/.test(t)));
  return i + 1;
}

/** The option whose range ("3-5 years", "5+", "Less than 1 year") holds the number in value. */
function rangeOption(options: Option[], value: string): Option | null {
  const n = Number(/\d+(\.\d+)?/.exec(value)?.[0] ?? NaN);
  if (!Number.isFinite(n)) return null;
  let lower: Option | null = null;
  let lowerHi = -Infinity;
  for (const o of options) {
    const t = o.label.toLowerCase();
    const nums = (t.match(/\d+(\.\d+)?/g) ?? []).map(Number);
    if (!nums.length) continue;
    if (/less than|under|fewer than|<|up to/.test(t) && n < nums[0]!) return o;
    if (/\+|or more|more than|over|above|at least|>|plus/.test(t) && nums.length === 1 && n >= nums[0]!) return o;
    if (nums.length >= 2) {
      if (n >= nums[0]! && n <= nums[1]!) return o;
      if (nums[1]! < n && nums[1]! > lowerHi) {
        lowerHi = nums[1]!;
        lower = o;
      }
    } else if (nums.length === 1 && !/less|under|more|over|\+/.test(t)) {
      if (n === nums[0]) return o;
      if (nums[0]! < n && nums[0]! > lowerHi) {
        lowerHi = nums[0]!;
        lower = o;
      }
    }
  }
  // Between ranges ("2.5" with "1-2" and "3-5"): the nearest lower one.
  return lower;
}

/** The option for the same place: its city first, then the state by code or name ("Dallas, TX" is "Dallas, Texas, United States"). */
function samePlace(real: Option[], value: string): Option | null {
  const [city = '', state = ''] = value.split(',').map((p) => p.trim());
  if (!city) return null;
  const c = norm(city);
  const code = state.toUpperCase();
  const names = [norm(state), US_STATES[code] ? norm(US_STATES[code]) : '', code.length === 2 ? code.toLowerCase() : ''].filter(Boolean);
  const inCity = real.filter((o) => norm(o.label) === c || norm(o.label).startsWith(`${c} `));
  if (!names.length) return inCity[0] ?? null;
  return inCity.find((o) => {
    const rest = ` ${norm(o.label).slice(c.length)} `;
    return names.some((n) => rest.includes(` ${n} `));
  }) ?? null;
}

/**
 * The suggestion that is this address: same house number and same town.
 * Streets repeat from town to town and country to country, and "St" and
 * "Street" read the same, so the street's name settles nothing.
 */
function sameAddress(real: Option[], value: string): Option | null {
  const [street = '', town = ''] = value.split(',').map((p) => p.trim());
  const house = /^\d+\b/.exec(street)?.[0];
  if (!house) return samePlace(real, value);
  const t = norm(town);
  return t ? real.find((o) => norm(o.label).startsWith(`${house} `) && ` ${norm(o.label)} `.includes(` ${t} `)) ?? null : null;
}

// Lists of names (schools, majors, employers) word the same name differently: "The University of Texas at Dallas".
const NAMED = new Set<FieldPurpose>(['school', 'edu_school', 'major', 'edu_major', 'current_company', 'exp_company', 'how_heard']);
// Proper names: the option must name the same school, subject or employer, never a namesake with more
// words ("State University" is not "Adams State University"). No match leaves it to the person.
const PROPER = new Set<FieldPurpose>(['school', 'edu_school', 'major', 'edu_major', 'current_company', 'exp_company']);
const FILLER = new Set(['the', 'of', 'at', 'in', 'and', 'for', 'a', 'an', 'university', 'college', 'school', 'institute', 'inc', 'llc', 'ltd', 'co', 'corp', 'corporation', 'company']);
const nameWords = (s: string) => norm(s).replace(/\+/g, ' ').split(' ').filter((w) => w.length > 1 && !FILLER.has(w));

/** Whether a field takes a proper name (school, subject, employer) that must match exactly. */
export const isProperName = (purpose: FieldPurpose | null) => !!purpose && PROPER.has(purpose);

const stripParens = (s: string) => s.replace(/\s*\([^)]*\)/g, ' ');

/** The option naming the same thing: every telling word of value, and the fewest others (none when two tie). */
function sameName(real: Option[], value: string, most = 2): Option | null {
  const wantRaw = nameWords(value);
  const wantBare = /\([^)]*\)/.test(value) ? nameWords(stripParens(value)) : wantRaw;
  if (!wantRaw.length && !wantBare.length) return null;
  let best: Option | null = null;
  let bestExtra = Infinity;
  let tie = false;
  for (const o of real) {
    const words = nameWords(o.label);
    const bare = /\([^)]*\)/.test(o.label) ? nameWords(stripParens(o.label)) : null;
    let extra = Infinity;
    if (wantRaw.length && wantRaw.every((w) => words.includes(w)) && words.length - wantRaw.length <= most) {
      extra = words.length - wantRaw.length;
    } else if (bare?.length && wantBare.length && wantBare.every((w) => bare.includes(w)) && bare.length - wantBare.length <= most) {
      // Parenthetical acronym/suffix ("University of Texas at Arlington (UTA)", "Computer Science (B.S.)"): slight penalty vs exact.
      extra = bare.length - wantBare.length + 0.5;
    } else if (wantBare.length && wantBare !== wantRaw && wantBare.every((w) => words.includes(w)) && words.length - wantBare.length <= most) {
      extra = words.length - wantBare.length + 0.5;
    }
    if (extra === Infinity) continue;
    if (extra < bestExtra) {
      best = o;
      bestExtra = extra;
      tie = false;
    } else if (extra === bestExtra) tie = true;
  }
  return tie ? null : best;
}

/** The option that means value by sense rather than wording (self-identification, degrees, months, ranges). */
function meaningOption(real: Option[], value: string, purpose: FieldPurpose | null): Option | null {
  const v = value.toLowerCase();
  let answers = real.filter((o) => !DECLINE.test(o.label));
  const rules = purpose ? MEANINGS[purpose] : undefined;
  // "I am a protected veteran" is never "I am not a protected veteran".
  if (rules && !NEGATED.test(norm(value))) answers = answers.filter((o) => !NEGATED.test(norm(o.label)) || purpose === 'race' || purpose === 'gender');
  if (rules) {
    for (const [isValue, isOption] of rules) {
      if (!isValue.test(v)) continue;
      // The first meaning the value has is the only one: "I am not a protected veteran"
      // must never fall through to the option for "protected veteran".
      return answers.find((o) => isOption.test(o.label.toLowerCase().trim())) ?? null;
    }
  }
  if (purpose === 'degree' || purpose === 'edu_degree') {
    const level = degreeLevel(value) || ({ "high school": 'high_school' } as Record<string, string>)[v] || '';
    if (level) {
      const sameLevel = answers.filter((o) => degreeLevel(o.label) === level);
      if (sameLevel.length) return sameDegree(sameLevel, value);
    }
  }
  const month = monthOf(value);
  if (month && answers.some((o) => monthOf(o.label) || monthOf(o.value))) {
    return answers.find((o) => monthOf(o.label) === month || monthOf(o.value) === month) ?? null;
  }
  if (purpose === 'years_experience') return rangeOption(answers, value);
  return null;
}

// On normalized text, where "don't" reads "don t".
const NEGATED = /\b(not|no|never|cannot|nicht|nein|non|nee|niet|geen)\b|n t\b/;
const YES_OPTION = /^(yes|ja|oui|si)\b/;
const NO_OPTION = /^(no|nein|non|nee)\b/;

/** A dropdown's prompt ("Select...", "Choose one", "-- Please select --"), not an answer ("Choose not to disclose" is one). */
export function isPlaceholderOption(label: string): boolean {
  return /^(-{2,}.*|(please )?(select|choose|pick)( one| an? (option|answer|item)| your answer| from the list)?\s*(\.{3}|…|:)?\s*(-{2,})?|bitte w[aä]hlen|ausw[aä]hlen|veuillez s[eé]lectionner|s[eé]lectionner|seleccionar|seleccione|selecteer|kies|month|year|day)$/i.test(label.trim());
}

// Veteran status in three states (see shared/selfId.ts). An option that says the person is a
// veteran ("I am a veteran, but not a protected veteran") is never "not a veteran": Workday
// tenants often list it first.
const SAYS_VETERAN = /\bi am a veteran|\bveteran,? but\b|\bnon.?protected veteran|\bidentify as a (non.?)?protected veteran|\bactive duty\b|\bdisabled veteran|\brecently separated|\bservice medal|\bwartime/;
const NOT_VETERAN = /\bnot a veteran\b|\bi am not a veteran|\bnever served|\bhave not served|\bno military service|^no\b|^none\b/;
const PROTECTED = /\bidentify as (one or more|a protected)|^(i am a )?protected veteran\b|\bclassifications of protected veteran|^yes\b|disabled veteran|recently separated|active duty wartime|service medal/;

/** The veteran option for a stored status, or null when no option means it. */
export function veteranOption(options: Option[], status: string): Option | null {
  const labelOf = (o: Option) => norm(o.label);
  const answers = options.filter((o) => !DECLINE.test(o.label));
  const s = norm(status);
  // An option's own words (a value already matched once, then filled).
  const same = options.find((o) => labelOf(o) === s || norm(o.value) === s);
  if (same) return same;
  if (s === 'decline' || DECLINE.test(status)) return options.find((o) => DECLINE.test(o.label)) ?? null;
  if (/^(i am )?not a (protected )?veteran$|^no$/.test(s)) {
    // Not a veteran at all: an option saying so, else the one that only denies being a protected
    // veteran (true of anyone who never served), else a bare "No". Never one that says "I am a veteran".
    return answers.find((o) => NOT_VETERAN.test(labelOf(o)) && !SAYS_VETERAN.test(labelOf(o)))
      ?? answers.find((o) => /\bnot a protected veteran\b/.test(labelOf(o)) && !SAYS_VETERAN.test(labelOf(o)))
      ?? null;
  }
  const yes = answers.length === 2 ? answers.find((o) => /^yes\b/.test(labelOf(o))) : undefined;
  if (/veteran,? but|not protected|non.?protected/.test(s)) {
    // "Are you a veteran?" Yes / No: a veteran is one, protected or not.
    if (yes) return yes;
    return answers.find((o) => /\bveteran,? (but|not protected)\b|\bnon.?protected veteran|\bidentify as a non.?protected/.test(labelOf(o)))
      ?? answers.find((o) => /\bnot a protected veteran\b/.test(labelOf(o)) && !NOT_VETERAN.test(labelOf(o).replace(/not a protected veteran/, '')))
      ?? null;
  }
  if (/protected veteran|^yes$/.test(s)) {
    if (yes) return yes;
    return answers.find((o) => PROTECTED.test(labelOf(o)) && !/\bnot\b|\bnon.?protected|veteran,? but/.test(labelOf(o))) ?? null;
  }
  return null;
}

/** Picks the option that means value (or its first alternative that fits), or null. */
export function matchOption(options: Option[], value: string, purpose: FieldPurpose | null): Option | null {
  const alts = alternatives(value);
  if (alts.length > 1) {
    for (const alt of alts) {
      const hit = matchOption(options, alt, purpose);
      if (hit) return hit;
    }
    return null;
  }
  const real = options.filter((o) => norm(o.label) !== '' && !isPlaceholderOption(o.label));
  if (!value) return null;
  if (purpose === 'veteran') return veteranOption(real, value);
  const v = norm(value);
  if (v === 'decline') return real.find((o) => DECLINE.test(o.label)) ?? null;
  if (v === 'yes' || v === 'no') {
    const wordRe = v === 'yes' ? YES_OPTION : NO_OPTION;
    const direct = real.filter((o) => wordRe.test(norm(o.label)));
    // Several ways of saying yes ("Yes, I live nearby", "Yes, I would relocate"): which one takes more than a yes.
    if (direct.length > 1) return null;
    if (direct[0]) return direct[0];
    // "I am authorized..." / "I am not authorized...": the one without a negation means yes.
    const answers = real.filter((o) => !DECLINE.test(o.label));
    if (answers.length === 2) {
      const neg = answers.map((o) => NEGATED.test(norm(o.label)));
      if (neg[0] !== neg[1]) return answers[neg.indexOf(v === 'no')] ?? null;
    }
    // Several ways of saying yes and one of saying no ("I currently work at Acme", "I previously
    // worked at Acme", "I have never worked at Acme"): a no is that one. A yes still needs the person.
    if (v === 'no') {
      const negs = answers.filter((o) => NEGATED.test(norm(o.label)));
      if (negs.length === 1 && answers.length > 2) return negs[0]!;
    }
    return null;
  }
  const wanted = new Set([v]);
  if ((purpose === 'country' || purpose === 'phone_code') && US_NAMES.includes(v)) US_NAMES.forEach((n) => wanted.add(norm(n)));
  if (purpose === 'phone_code' && US_NAMES.includes(v)) wanted.add('+1');
  if (purpose === 'state') {
    const up = value.trim().toUpperCase();
    if (US_STATES[up]) wanted.add(norm(US_STATES[up]));
    for (const [abbr, name] of Object.entries(US_STATES)) if (norm(name) === v) wanted.add(abbr.toLowerCase());
  }
  const exact = real.find((o) => wanted.has(norm(o.label)) || wanted.has(norm(o.value)));
  if (exact) return exact;
  if (purpose === 'address') return sameAddress(real, value);
  if (purpose === 'location' || purpose === 'city') {
    const place = samePlace(real, value);
    if (place) return place;
  }
  const meant = meaningOption(real, value, purpose);
  if (meant) return meant;
  if (purpose && PROPER.has(purpose)) return sameName(real, value, 0);
  // Self-identification is what the person said or nothing: "Asian" never becomes "East Asian".
  if (purpose && SELF_ID.has(purpose)) return null;
  return (
    real.find((o) => [...wanted].some((w) => w.length > 2 && norm(o.label).startsWith(w))) ??
    (purpose && NAMED.has(purpose) ? sameName(real, value) : null) ??
    // A whole-word match ("Computer Science" in "B.S. Computer Science"), never inside a word ("male" in "female").
    real.find((o) => [...wanted].some((w) => w.length > 3 && new RegExp(`(^| )${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(norm(o.label)))) ??
    null
  );
}

/** What to type into a searchable dropdown so the right option shows: full names, not codes. */
export function searchText(value: string, purpose: FieldPurpose | null): string {
  value = firstChoice(value);
  const v = norm(value);
  if (v === 'decline') return '';
  if (v === 'yes' || v === 'no') return v === 'yes' ? 'Yes' : 'No';
  if (purpose === 'state' && US_STATES[value.trim().toUpperCase()]) return US_STATES[value.trim().toUpperCase()]!;
  // Place searches find "Dallas" more often than "Dallas, TX".
  if (purpose === 'location' || purpose === 'city') return value.split(',')[0]!.trim();
  if ((purpose === 'country' || purpose === 'phone_code') && US_NAMES.includes(v)) return 'United States';
  return value;
}
