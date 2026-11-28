import type { JobDraft } from './types';
import type { WeraUser } from './api';

/** Where the extension keeps its sign-in (chrome.storage.local). */
export interface Session {
  server: string;
  token: string;
  user: WeraUser;
}

const KEY = 'wera.session';

/** Where almost everyone's Wera is; before sign-in, the dashboard there can connect the extension. */
export const DEFAULT_SERVER = 'https://www.wera-jobs.com';

export async function loadSession(): Promise<Session | null> {
  const got = await chrome.storage.local.get(KEY);
  return (got[KEY] as Session | undefined) ?? null;
}

export async function saveSession(s: Session | null): Promise<void> {
  if (s) await chrome.storage.local.set({ [KEY]: s });
  else await chrome.storage.local.remove(KEY);
}

const TAB_JOBS = 'wera.tabJobs';
const TAB_JOB_TTL = 15 * 60_000;

interface TabJobEntry {
  origin: string;
  jobId: number;
  at?: number;
}

/**
 * The job a tab was on, so moving from a posting to its application form
 * (often a different URL or external ATS) keeps the job. Session storage:
 * cleared when the browser closes.
 */
export async function rememberTabJob(tabId: number, origin: string, jobId: number): Promise<void> {
  const got = await chrome.storage.session.get(TAB_JOBS);
  const map = (got[TAB_JOBS] as Record<string, TabJobEntry> | undefined) ?? {};
  map[tabId] = { origin, jobId, at: Date.now() };
  await chrome.storage.session.set({ [TAB_JOBS]: map });
}

export async function tabJob(tabId: number, origin: string): Promise<number | null> {
  const got = await chrome.storage.session.get(TAB_JOBS);
  const hit = (got[TAB_JOBS] as Record<string, TabJobEntry> | undefined)?.[tabId];
  return hit && hit.origin === origin ? hit.jobId : null;
}

/** A recently remembered job on this tab across origins (e.g. careers page redirecting to Workday/Greenhouse). */
export async function recentTabJob(tabId: number, maxAgeMs = TAB_JOB_TTL): Promise<number | null> {
  const got = await chrome.storage.session.get(TAB_JOBS);
  const hit = (got[TAB_JOBS] as Record<string, TabJobEntry> | undefined)?.[tabId];
  if (!hit) return null;
  if (hit.at != null && Date.now() - hit.at > maxAgeMs) return null;
  return hit.jobId;
}

/** Copies a tab's recent job to a new tab opened from it (e.g. clicking Apply that opens an ATS in a new tab). */
export async function passTabJob(fromTabId: number, toTabId: number): Promise<void> {
  const got = await chrome.storage.session.get(TAB_JOBS);
  const map = (got[TAB_JOBS] as Record<string, TabJobEntry> | undefined) ?? {};
  const hit = map[fromTabId];
  if (!hit || (hit.at != null && Date.now() - hit.at > TAB_JOB_TTL)) return;
  map[toTabId] = { ...hit, at: Date.now() };
  await chrome.storage.session.set({ [TAB_JOBS]: map });
}

/** "http://192.168.4.68:3000/" -> "http://192.168.4.68:3000"; null when not http(s). */
export function normalizeServer(raw: string): string | null {
  try {
    const u = new URL(raw.trim().includes('://') ? raw.trim() : `https://${raw.trim()}`);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

const TAB_PAGES = 'wera.tabPages';

/** What the page script saw in a tab: when it last showed a form, and the posting it last showed. */
export interface TabPage {
  formAt?: number;
  /** The site (top frame's host) the form was on: a confirmation counts only there. */
  formHost?: string;
  /** When the user last clicked the form's Submit. */
  sentAt?: number;
  draft?: JobDraft;
  at: number;
}

export async function tabPages(): Promise<Record<string, TabPage>> {
  const got = await chrome.storage.session.get(TAB_PAGES);
  return (got[TAB_PAGES] as Record<string, TabPage> | undefined) ?? {};
}

export async function notePage(tabId: number, patch: Partial<TabPage>): Promise<TabPage> {
  const map = await tabPages();
  const next = { ...map[tabId], ...patch, at: Date.now() };
  map[tabId] = next;
  for (const [k, v] of Object.entries(map)) if (Date.now() - v.at > 12 * 3600_000) delete map[k];
  await chrome.storage.session.set({ [TAB_PAGES]: map });
  return next;
}

/** Per-tab maps in session storage, pruned when their tab closes. */
const PER_TAB = [TAB_JOBS, TAB_PAGES, 'wera.flows', 'wera.applying', 'wera.tabOpen'];

/** Forgets a closed tab in every per-tab map. */
export async function forgetTab(tabId: number): Promise<void> {
  const got = await chrome.storage.session.get(PER_TAB);
  const next: Record<string, unknown> = {};
  for (const key of PER_TAB) {
    const map = got[key] as Record<string, unknown> | undefined;
    if (map && String(tabId) in map) {
      const { [String(tabId)]: _gone, ...rest } = map;
      next[key] = rest;
    }
  }
  if (Object.keys(next).length) await chrome.storage.session.set(next);
}

const PENDING_SERVER = 'wera.pendingServer';

/** The other Wera server the user is connecting through (signed out), for an hour. */
export async function pendingServer(): Promise<string | null> {
  const got: Record<string, unknown> = await chrome.storage.session.get(PENDING_SERVER).catch(() => ({}));
  const p = got[PENDING_SERVER] as { server: string; at: number } | undefined;
  return p && Date.now() - p.at < 3_600_000 ? p.server : null;
}

export async function setPendingServer(server: string | null): Promise<void> {
  if (server) await chrome.storage.session.set({ [PENDING_SERVER]: { server, at: Date.now() } });
  else await chrome.storage.session.remove(PENDING_SERVER);
}
