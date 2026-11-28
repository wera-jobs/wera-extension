// The application queue (#150): jobs the person lined up to apply to.
// Wera opens each in a background tab, two at a time, and fills it; the
// person reviews each one and presses Submit themselves. Wera never
// submits. Kept in chrome.storage.local, so the background, the panels
// and the board pages all see it.

export const QUEUE_KEY = 'wera.queue';
/** At most this many applications fill at once (each is a tab with a form). */
export const QUEUE_AT_ONCE = 2;
/** A fill that has not reported back by then is given up on. */
export const QUEUE_FILL_MS = 4 * 60_000;
const MAX_ITEMS = 30;

export type QueueStatus = 'waiting' | 'filling' | 'ready' | 'needs' | 'submitted' | 'failed';

export interface QueueItem {
  id: string;
  url: string;
  title: string;
  company: string;
  jobId?: number;
  tabId?: number;
  status: QueueStatus;
  /** Fields Wera filled, and the ones left for the person. */
  filled?: number;
  needs?: number;
  /** When it last changed state. */
  at: number;
}

export async function loadQueue(): Promise<QueueItem[]> {
  const got = await chrome.storage.local.get(QUEUE_KEY);
  return Array.isArray(got[QUEUE_KEY]) ? (got[QUEUE_KEY] as QueueItem[]) : [];
}

async function saveQueue(items: QueueItem[]): Promise<void> {
  await chrome.storage.local.set({ [QUEUE_KEY]: items });
}

/** Changes the queue in one read and write. */
export async function changeQueue(fn: (items: QueueItem[]) => QueueItem[]): Promise<QueueItem[]> {
  const next = fn(await loadQueue());
  await saveQueue(next);
  return next;
}

/** Lines a job up (once per address). Returns false when the queue is full. */
export async function addToQueue(job: { url: string; title: string; company: string; jobId?: number }): Promise<boolean> {
  let added = false;
  await changeQueue((items) => {
    if (items.some((i) => i.url === job.url && i.status !== 'submitted' && i.status !== 'failed')) {
      added = true;
      return items;
    }
    const kept = items.filter((i) => i.url !== job.url);
    if (kept.filter((i) => i.status !== 'submitted').length >= MAX_ITEMS) return items;
    added = true;
    return [...kept, { ...job, id: `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, status: 'waiting', at: Date.now() }];
  });
  return added;
}

/** What the tab's application came to, from its panel. */
export async function reportQueueTab(tabId: number, patch: Partial<Pick<QueueItem, 'status' | 'filled' | 'needs'>>): Promise<void> {
  const items = await loadQueue();
  if (!items.some((i) => i.tabId === tabId)) return;
  await saveQueue(items.map((i) => (i.tabId === tabId ? { ...i, ...patch, at: Date.now() } : i)));
}

/** Whether this tab is one the queue opened, still filling. */
export async function queuedTab(tabId: number): Promise<QueueItem | null> {
  return (await loadQueue()).find((i) => i.tabId === tabId && i.status === 'filling') ?? null;
}

/**
 * The queue's next moves: items to open now, and fills given up on. Pure,
 * so the background's runner is easy to test.
 */
export function queuePlan(items: QueueItem[], now = Date.now()): { open: QueueItem[]; stale: QueueItem[] } {
  const stale = items.filter((i) => i.status === 'filling' && now - i.at > QUEUE_FILL_MS);
  const busy = items.filter((i) => i.status === 'filling').length - stale.length;
  const open = items.filter((i) => i.status === 'waiting').slice(0, Math.max(0, QUEUE_AT_ONCE - busy));
  return { open, stale };
}

/** The queued application moved to a tab its page opened (Apply opens a new tab). */
export async function passQueueTab(fromTabId: number, toTabId: number): Promise<void> {
  const items = await loadQueue();
  if (!items.some((i) => i.tabId === fromTabId && i.status === 'filling')) return;
  await saveQueue(items.map((i) => (i.tabId === fromTabId && i.status === 'filling' ? { ...i, tabId: toTabId, at: Date.now() } : i)));
}
