import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApplicantView } from './api';
import type { Applicant } from './types';
import { clearProfileCache, loadProfileCache, saveProfileCache } from './profileCache';

const view: ApplicantView = {
  applicant: { first_name: 'Ada' } as Applicant,
  saved: true,
  sources: {},
  experience: [],
  education: [],
  skills: [],
};

function stubSession() {
  const store: Record<string, unknown> = {};
  vi.stubGlobal('chrome', {
    storage: {
      session: {
        get: vi.fn(async (k: string) => (k in store ? { [k]: store[k] } : {})),
        set: vi.fn(async (o: Record<string, unknown>) => void Object.assign(store, o)),
        remove: vi.fn(async (k: string) => void delete store[k]),
      },
    },
  });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe('profileCache', () => {
  it('returns cached details for the same server within TTL, and expires after TTL or server change', async () => {
    stubSession();
    expect(await loadProfileCache('https://wera.example', 1000)).toBeNull();
    await saveProfileCache('https://wera.example', view, [], 1000);
    expect(await loadProfileCache('https://wera.example', 5 * 60_000)).toEqual({ view, saved: [] });
    expect(await loadProfileCache('https://other.example', 5 * 60_000)).toBeNull();
    expect(await loadProfileCache('https://wera.example', 11 * 60_000)).toBeNull();
  });

  it('clears the cache on sign-out', async () => {
    stubSession();
    await saveProfileCache('https://wera.example', view, [], 1000);
    await clearProfileCache();
    expect(await loadProfileCache('https://wera.example', 2000)).toBeNull();
  });
});
