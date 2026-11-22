// Session cache for the user's applicant details and saved answers bank:
// keeps autofill responsive (< 3s for known facts) without waiting on
// repeated API round-trips on every application page. Stored in
// chrome.storage.session so it clears automatically on browser close and
// on sign-out.
import type { SavedAnswer } from './answers';
import type { ApplicantView } from './api';

const KEY = 'wera.profileCache';
const TTL_MS = 10 * 60_000;

export interface ProfileCache {
  server: string;
  at: number;
  view: ApplicantView;
  saved: SavedAnswer[];
}

export async function loadProfileCache(server: string, now = Date.now()): Promise<{ view: ApplicantView; saved: SavedAnswer[] } | null> {
  const got = (await chrome.storage?.session?.get(KEY).catch((): Record<string, unknown> => ({}))) ?? {};
  const entry = got[KEY] as ProfileCache | undefined;
  if (!entry || entry.server !== server || now - entry.at >= TTL_MS) return null;
  return { view: entry.view, saved: entry.saved };
}

export async function saveProfileCache(server: string, view: ApplicantView, saved: SavedAnswer[], now = Date.now()): Promise<void> {
  const entry: ProfileCache = { server, at: now, view, saved };
  await chrome.storage?.session?.set({ [KEY]: entry }).catch(() => {});
}

export async function clearProfileCache(): Promise<void> {
  await chrome.storage?.session?.remove?.(KEY).catch(() => {});
}
