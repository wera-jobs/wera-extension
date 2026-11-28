// The one password the person uses for job-site accounts (Workday wants an
// account per company). It never leaves this browser and is never sent to
// Wera: it is kept in chrome.storage.local encrypted with AES-GCM, under a
// key the browser made and will not export, kept in the extension's own
// IndexedDB (not a page's). Only the background reads it, for the panel.

const DB = 'wera-vault';
const STORE = 'keys';
const KEY_ID = 'job-site';
const BLOB = 'wera.jobSitePassword';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('could not open the vault'));
  });
}

async function key(create: boolean): Promise<CryptoKey | null> {
  const db = await openDb();
  const got = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const r = db.transaction(STORE).objectStore(STORE).get(KEY_ID);
    r.onsuccess = () => resolve(r.result as CryptoKey | undefined);
    r.onerror = () => reject(r.error ?? new Error('could not read the vault'));
  });
  if (got || !create) return got ?? null;
  const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(k, KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('could not write the vault'));
  });
  return k;
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Keeps the password (or forgets it, for ''). */
export async function setJobSitePassword(password: string): Promise<void> {
  if (!password) {
    await chrome.storage.local.remove(BLOB);
    return;
  }
  const k = (await key(true))!;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(password)));
  await chrome.storage.local.set({ [BLOB]: { iv: b64(iv), data: b64(data) } });
}

/** The kept password, or '' when there is none (or the key is gone). */
export async function jobSitePassword(): Promise<string> {
  const got = await chrome.storage.local.get(BLOB);
  const blob = got[BLOB] as { iv: string; data: string } | undefined;
  if (!blob) return '';
  const k = await key(false);
  if (!k) return '';
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, k, unb64(blob.data));
    return new TextDecoder().decode(plain);
  } catch {
    return '';
  }
}

/** A strong password job sites accept: 16 characters with upper and lower case, a digit and a symbol. */
export function strongPassword(): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?'];
  const all = sets.join('');
  const pick = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0]! % s.length]!;
  const chars = [...sets.map(pick), ...Array.from({ length: 12 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}
