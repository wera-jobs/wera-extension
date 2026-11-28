// Site rules as data (#143): sites, field aliases, Next selectors and
// feature switches, fetched hourly by the background from the user's Wera
// (GET /api/ext/rules) and kept in storage, so a broken selector is fixed
// for everyone without a store release. Page scripts read the kept copy.
// No code runs from them: patterns are short regular expressions and CSS
// selectors, checked before use.
import type { FieldPurpose } from './types';

export const RULES_KEY = 'wera.remoteRules';
/** How often the background asks for fresh rules. */
export const RULES_EVERY_MS = 60 * 60_000;

export interface RemoteSite {
  name: string;
  /** The hosts it runs on (a regular expression on the hostname). */
  hosts: string;
  /** [pattern on the field's own names and label, purpose or null to leave it alone]. */
  fields?: [string, FieldPurpose | null][];
  /** CSS selectors of its Next button, tried in turn. */
  next?: string[];
  /** [CSS selector that marks a pre-form page, what the user should do]. */
  gate?: [string, string][];
  pace?: number;
}

export interface RemoteRules {
  version: number;
  /** Features to turn off everywhere at once (a misbehaving one): only false counts. */
  switches?: Partial<Record<'aiSuggest' | 'aiQuestions' | 'assist' | 'boardBadges' | 'autoContinue', boolean>>;
  /** [pattern on a field's label, purpose]: read before the built-in rules. */
  aliases?: [string, FieldPurpose | null][];
  sites?: RemoteSite[];
}

const compiled = new Map<string, RegExp | null>();

/** A pattern from the rules as a RegExp (compiled once), or null when it is too long or not one. */
export function pattern(src: unknown): RegExp | null {
  if (typeof src !== 'string' || !src || src.length > 200) return null;
  if (compiled.has(src)) return compiled.get(src)!;
  let re: RegExp | null;
  try {
    re = new RegExp(src, 'i');
  } catch {
    re = null;
  }
  compiled.set(src, re);
  return re;
}

/** Features the remote rules turn off everywhere (a misbehaving one). */
export function switchedOff<T extends Record<string, unknown>>(settings: T, rules: RemoteRules | null): T {
  const off = Object.entries(rules?.switches ?? {}).filter(([, v]) => v === false).map(([k]) => k);
  return off.length ? { ...settings, ...Object.fromEntries(off.filter((k) => k in settings).map((k) => [k, false])) } : settings;
}

/** Keeps only well-formed parts of fetched rules. */
export function cleanRules(raw: unknown): RemoteRules | null {
  if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== 1) return null;
  const r = raw as RemoteRules;
  const pairs = (list: unknown) => (Array.isArray(list) ? list : []).filter((p): p is [string, FieldPurpose | null] =>
    Array.isArray(p) && p.length === 2 && !!pattern(p[0]) && (p[1] === null || typeof p[1] === 'string')).slice(0, 500);
  const sites = (Array.isArray(r.sites) ? r.sites : []).filter((s) => s && typeof s.name === 'string' && !!pattern(s.hosts)).slice(0, 100).map((s) => ({
    name: s.name.slice(0, 60), hosts: s.hosts, fields: pairs(s.fields),
    next: (Array.isArray(s.next) ? s.next : []).filter((x): x is string => typeof x === 'string' && x.length <= 200).slice(0, 10),
    gate: (Array.isArray(s.gate) ? s.gate : []).filter((g): g is [string, string] => Array.isArray(g) && typeof g[0] === 'string' && typeof g[1] === 'string').slice(0, 10),
    ...(typeof s.pace === 'number' && s.pace >= 0 && s.pace <= 1000 ? { pace: s.pace } : {}),
  }));
  const switches = Object.fromEntries(Object.entries(r.switches ?? {}).filter(([, v]) => v === false));
  return { version: 1, switches, aliases: pairs(r.aliases), sites };
}

let current: RemoteRules | null = null;

/** The rules this page has (none until loaded). */
export function remoteRules(): RemoteRules | null {
  return current;
}

/** For tests, and after a fresh copy arrives. */
export function setRemoteRules(r: RemoteRules | null) {
  current = r;
}

/** Loads the kept copy into this page (page scripts call it once at start). */
export async function loadRemoteRules(): Promise<void> {
  try {
    const got = await chrome.storage.local.get(RULES_KEY);
    current = cleanRules((got[RULES_KEY] as { rules?: unknown } | undefined)?.rules);
  } catch {
    current = null;
  }
}
