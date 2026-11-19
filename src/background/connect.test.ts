import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptDashboardKey } from './connect';

const store: Record<string, unknown> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (k: string) => ({ [k]: store[k] }),
        set: async (o: Record<string, unknown>) => Object.assign(store, o),
        remove: async (k: string) => delete store[k],
      },
    },
  });
});

const me = vi.fn(async () => ({ user: { id: 1, email: 'ada@example.com', name: 'Ada', is_admin: false } }));

describe('connecting from the dashboard', () => {
  it('keeps a working key from the default Wera before sign-in', async () => {
    expect(await acceptDashboardKey('https://www.wera-jobs.com', 'wera_ext_abc', me)).toBe(true);
    expect(store['wera.session']).toMatchObject({ server: 'https://www.wera-jobs.com', token: 'wera_ext_abc' });
  });

  it('refuses another site, a key that is not an extension key, and a key the server rejects', async () => {
    expect(await acceptDashboardKey('https://evil.example', 'wera_ext_abc', me)).toBe(false);
    expect(await acceptDashboardKey('https://www.wera-jobs.com', 'session-cookie', me)).toBe(false);
    expect(await acceptDashboardKey('https://www.wera-jobs.com', 'wera_ext_bad', async () => { throw new Error('401'); })).toBe(false);
    expect(store['wera.session']).toBeUndefined();
  });
});
