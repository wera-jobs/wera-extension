// Runs the application queue (see shared/queue): opens waiting jobs in
// background tabs, two at a time, marked so their application fills
// itself, and moves on as each reports back.
import { markApplying } from '../shared/flow';
import { changeQueue, loadQueue, queuePlan, QUEUE_KEY } from '../shared/queue';
import { rememberTabJob } from '../shared/storage';

let running: Promise<void> = Promise.resolve();

/** One pass at a time: storage events can come in bursts. */
export function pumpQueue(): Promise<void> {
  running = running.then(pass).catch(() => {});
  return running;
}

async function pass(): Promise<void> {
  const { open, stale } = queuePlan(await loadQueue());
  if (stale.length) await changeQueue((items) => items.map((i) => (stale.some((s) => s.id === i.id) ? { ...i, status: 'failed', at: Date.now() } : i)));
  for (const item of open) {
    const tab = await chrome.tabs.create({ url: item.url, active: false });
    if (tab.id == null) continue;
    await markApplying(tab.id);
    if (item.jobId) await rememberTabJob(tab.id, new URL(item.url).origin, item.jobId).catch(() => {});
    await changeQueue((items) => items.map((i) => (i.id === item.id ? { ...i, status: 'filling', tabId: tab.id, at: Date.now() } : i)));
  }
}

/** A queued tab the person closed: its application is out of the queue's hands. */
export async function queueTabClosed(tabId: number): Promise<void> {
  const items = await loadQueue();
  if (!items.some((i) => i.tabId === tabId)) return;
  await changeQueue((list) => list.map((i) => (i.tabId === tabId ? { ...i, tabId: undefined, status: i.status === 'filling' ? 'failed' : i.status, at: Date.now() } : i)));
}

export function watchQueue(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[QUEUE_KEY]) void pumpQueue();
  });
  // A fill that never reported back is noticed on the next look: any tab finishing a load is one.
  chrome.tabs.onUpdated.addListener((_id, info) => {
    if (info.status === 'complete') void pumpQueue();
  });
}
