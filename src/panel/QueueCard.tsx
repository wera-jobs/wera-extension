// The application queue in the panel (#150): what Wera has filled in the
// background, and a Review button that brings each one forward for the
// person to check and submit. Wera never submits.
import { useEffect, useState } from 'react';
import { ListChecks, X } from 'lucide-react';
import { changeQueue, loadQueue, QUEUE_KEY, type QueueItem, type QueueStatus } from '../shared/queue';

const WORDS: Record<QueueStatus, [string, string]> = {
  waiting: ['Waiting', 'text-faint'],
  filling: ['Filling…', 'text-muted'],
  ready: ['Ready to review', 'text-good'],
  needs: ['Needs you', 'text-warn'],
  submitted: ['Submitted', 'text-faint'],
  failed: ["Didn't fill", 'text-bad'],
};

export function useQueue(): QueueItem[] {
  const [items, setItems] = useState<QueueItem[]>([]);
  useEffect(() => {
    void loadQueue().then(setItems, () => {});
    const on = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[QUEUE_KEY]) setItems((changes[QUEUE_KEY].newValue as QueueItem[] | undefined) ?? []);
    };
    chrome.storage.onChanged?.addListener(on);
    return () => chrome.storage.onChanged?.removeListener(on);
  }, []);
  return items;
}

export function QueueCard({ tabId }: { tabId: number | null }) {
  const items = useQueue();
  const open = items.filter((i) => i.status !== 'submitted');
  if (!open.length) return null;
  const done = items.length - open.length;
  const review = (i: QueueItem) => {
    if (i.tabId != null) void chrome.runtime.sendMessage({ type: 'wera:queue-focus', tabId: i.tabId }).catch(() => {});
    else void changeQueue((list) => list.map((x) => (x.id === i.id ? { ...x, status: 'waiting', at: Date.now() } : x)));
  };
  const remove = (i: QueueItem) => void changeQueue((list) => list.filter((x) => x.id !== i.id));
  const clear = () => void changeQueue((list) => list.filter((x) => x.status !== 'submitted' && x.status !== 'failed'));
  return (
    <section aria-label="Application queue" className="rounded-card border border-border bg-surface px-3 py-2.5 text-xs">
      <header className="mb-1.5 flex items-center gap-1.5">
        <ListChecks className="size-3.5 text-accent" />
        <span className="font-medium text-text">Application queue</span>
        <span className="text-faint">{done ? `${done} submitted` : 'You review and submit each one'}</span>
        {items.some((i) => i.status === 'submitted' || i.status === 'failed') && (
          <button type="button" onClick={clear} className="ml-auto text-faint hover:text-text">Clear done</button>
        )}
      </header>
      <ul className="space-y-1">
        {open.map((i) => {
          const [word, tone] = WORDS[i.status];
          const here = i.tabId != null && i.tabId === tabId;
          return (
            <li key={i.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-text" title={`${i.title} at ${i.company}`}>{i.title} <span className="text-faint">· {i.company}</span></p>
                <p className={tone}>{here ? 'This tab' : word}{i.status === 'needs' && i.needs ? `: ${i.needs} to check` : ''}{i.status === 'ready' && i.filled ? `: ${i.filled} filled` : ''}</p>
              </div>
              {(i.status === 'ready' || i.status === 'needs') && !here && (
                <button type="button" onClick={() => review(i)} className="rounded-md border border-border px-2 py-0.5 font-medium text-text hover:bg-surface-2">Review</button>
              )}
              {i.status === 'failed' && (
                <button type="button" onClick={() => review(i)} className="rounded-md border border-border px-2 py-0.5 font-medium text-text hover:bg-surface-2">{i.tabId != null ? 'Open' : 'Retry'}</button>
              )}
              <button type="button" aria-label={`Remove ${i.title} from the queue`} onClick={() => remove(i)} className="text-faint hover:text-text"><X className="size-3.5" /></button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
