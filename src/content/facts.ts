// What a job seeker wants to know about a posting at a glance, read from
// the page itself: the pay it states, when it went up, and whether it has
// expired. Pure text and date work, unit-tested.

/** A pay figure: "120,000", "120,000.00", "120k", "45.50". */
const AMOUNT = String.raw`\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?([kK])?`;
/** The top of a range may leave out its sign: "$120-150K". */
const TOP = AMOUNT.replace(String.raw`\$\s?`, String.raw`\$?\s?`);
const CURRENCY = String.raw`USD|CAD|AUD|NZD|SGD|HKD`;
const RANGE = new RegExp(
  String.raw`${AMOUNT}(?:\s*(${CURRENCY})\b)?(?:\s*(?:-|–|—|to|and)\s*${TOP})?(?:\s*(${CURRENCY})\b)?\s*(?:(?:per|an|a|/)\s*(hour|hr|year|yr|annum|month|mo)\b)?`,
  'g',
);
const SIGN: Record<string, string> = { USD: '$', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$', SGD: 'S$', HKD: 'HK$' };

/** Words that make a dollar figure a salary, near it. */
const PAY_WORDS = /\b(salary|salaries|pay|compensation|base|wage|wages|hourly|annual(?:ly)?|per (?:hour|year|annum)|ote|earn|range)\b/i;
/** Words that make it something else: funding, revenue, a benefit, a bonus. */
const NOT_PAY = /\b(raised|funding|funded|series [a-e]|revenue|valuation|billion|million|budget|stipend|reimburse\w*|allowance|bonus|401\s?\(?k|match|per (?:employee|month for)|grant|credit|deductible|donat\w*|market cap|assets)\b/i;

/**
 * The sentence around text[from, to], at most 120 characters before it and
 * 60 after. Lines do not end it: postings put "Pay range:" on a line of its
 * own above the figures.
 */
function sentence(text: string, from: number, to: number): string {
  const before = text.slice(Math.max(0, from - 120), from);
  const cut = Math.max(before.search(/(?<=[.!?]\s)[^.!?]*$|^[^.!?]*$/), 0);
  const after = text.slice(to, to + 60);
  const end = after.search(/[.!?](\s|$)/);
  return before.slice(cut) + text.slice(from, to) + (end < 0 ? after : after.slice(0, end));
}

const num = (digits: string, k: string | undefined) => {
  const n = Number(digits.replace(/,/g, ''));
  return k ? n * 1000 : n;
};

/** 120000 as "$120K", 45.5 as "$45.50". */
function money(n: number, sign: string): string {
  if (n >= 1000) return `${sign}${Number.isInteger(n / 1000) ? n / 1000 : (n / 1000).toFixed(1)}K`;
  return `${sign}${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

/**
 * The pay range a posting states, as "$120K – $150K a year" or "$25 – $30
 * an hour". Only a figure with a pay word near it and nothing that makes it
 * funding, revenue or a benefit counts, and only amounts that are a
 * plausible wage. Empty when the posting states none.
 */
export function payFromText(text: string): string {
  for (const m of text.matchAll(RANGE)) {
    const at = m.index ?? 0;
    const near = sentence(text, at, at + m[0].length);
    if (!PAY_WORDS.test(near) || NOT_PAY.test(near)) continue;
    const [, loDigits, loK, cur1, hiDigits, hiK, cur2, per] = m;
    let lo = num(loDigits!, loK);
    const hi = hiDigits ? num(hiDigits, hiK ?? loK) : 0;
    if (!loK && hiK && lo < 1000) lo *= 1000; // "$120-150K"
    let unit = (per ?? '').toLowerCase();
    if (!unit) unit = lo >= 15_000 ? 'year' : lo >= 7 && lo <= 300 ? 'hour' : '';
    const hourly = unit === 'hour' || unit === 'hr';
    const yearly = unit === 'year' || unit === 'yr' || unit === 'annum';
    if (hourly ? lo < 7 || lo > 500 : yearly ? lo < 15_000 || lo > 2_000_000 : true) continue;
    if (hi && (hi < lo || hi > lo * 4)) continue;
    const sign = SIGN[(cur2 ?? cur1 ?? 'USD').toUpperCase()] ?? '$';
    const each = hourly ? ' an hour' : ' a year';
    return hi && hi !== lo ? `${money(lo, sign)} – ${money(hi, sign)}${each}` : `${money(lo, sign)}${each}`;
  }
  return '';
}

/** "$120,000 - $150,000 per year" from page data, in the same short form. */
export function shortPay(pay: string): string {
  return pay ? payFromText(`salary ${pay}`) || pay : '';
}

const DAY = 86_400_000;

/** Days from an ISO date to now (negative: in the future); null when unreadable. */
export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.floor((now - t) / DAY);
}

/** "today", "yesterday", "5 days ago", "3 weeks ago", "4 months ago". */
export function ageWords(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const y = Math.round(days / 365);
  return y === 1 ? 'a year ago' : `${y} years ago`;
}

/** Postings up longer than this are flagged: many are filled already. The dashboard uses the same. */
export const OLD_POSTING_DAYS = 60;
