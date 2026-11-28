// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pumpQueue, queueTabClosed } from '../background/queue';
import { QueueCard } from '../panel/QueueCard';
import { addToQueue, loadQueue, passQueueTab, queuePlan, QUEUE_FILL_MS, reportQueueTab, type QueueItem } from './queue';

let local: Record<string, unknown>;
let session: Record<string, unknown>;
let nextTab: number;
const sent: unknown[] = [];
const area = (data: () => Record<string, unknown>) => ({
  get: async (k: string | string[]) => Object.fromEntries((Array.isArray(k) ? k : [k]).filter((x) => x in data()).map((x) => [x, data()[x]])),
  set: async (o: Record<string, unknown>) => void Object.assign(data(), o),
});

beforeEach(() => {
  local = {};
  session = {};
  nextTab = 100;
  sent.length = 0;
  vi.stubGlobal('chrome', {
    storage: { local: area(() => local), session: area(() => session), onChanged: { addListener: () => {}, removeListener: () => {} } },
    tabs: { create: vi.fn(async () => ({ id: nextTab++ })), onUpdated: { addListener: () => {} } },
    runtime: { sendMessage: vi.fn(async (m: unknown) => void sent.push(m)) },
  });
});

const item = (n: number, patch: Partial<QueueItem> = {}): QueueItem => ({ id: `q${n}`, url: `https://jobs.example/${n}`, title: `Role ${n}`, company: 'Acme', status: 'waiting', at: 0, ...patch });

describe('application queue (#150)', () => {
  it('opens two at a time, and gives up on a fill that never reported back', () => {
    const now = 10 * QUEUE_FILL_MS;
    expect(queuePlan([item(1), item(2), item(3)], now).open.map((i) => i.id)).toEqual(['q1', 'q2']);
    expect(queuePlan([item(1, { status: 'filling', at: now }), item(2), item(3)], now).open.map((i) => i.id)).toEqual(['q2']);
    const plan = queuePlan([item(1, { status: 'filling', at: 0 }), item(2, { status: 'filling', at: now }), item(3)], now);
    expect(plan.stale.map((i) => i.id)).toEqual(['q1']);
    expect(plan.open.map((i) => i.id)).toEqual(['q3']);
  });

  it('adds a job once, and the background opens it in a background tab marked to fill', async () => {
    expect(await addToQueue({ url: 'https://jobs.example/1', title: 'Data Analyst', company: 'Globex' })).toBe(true);
    expect(await addToQueue({ url: 'https://jobs.example/1', title: 'Data Analyst', company: 'Globex' })).toBe(true);
    expect(await loadQueue()).toHaveLength(1);
    await pumpQueue();
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'https://jobs.example/1', active: false });
    const [q] = await loadQueue();
    expect(q).toMatchObject({ status: 'filling', tabId: 100 });
    expect(Object.keys((session['wera.applying'] as Record<string, number>) ?? {})).toEqual(['100']);
  });

  it('follows the application into the tab Apply opened, and hears how it came out', async () => {
    local['wera.queue'] = [item(1, { status: 'filling', tabId: 5, at: Date.now() })];
    await passQueueTab(5, 6);
    await reportQueueTab(6, { status: 'needs', filled: 14, needs: 2 });
    expect((await loadQueue())[0]).toMatchObject({ tabId: 6, status: 'needs', filled: 14, needs: 2 });
    await queueTabClosed(6);
    expect((await loadQueue())[0]).toMatchObject({ status: 'needs', tabId: undefined });
  });

  it('the panel lists the queue; Review brings the tab forward; Wera never submits', async () => {
    local['wera.queue'] = [
      item(1, { status: 'ready', tabId: 11, filled: 18 }),
      item(2, { status: 'needs', tabId: 12, needs: 3 }),
      item(3, { status: 'submitted' }),
    ];
    render(<QueueCard tabId={null} />);
    expect(await screen.findByText('Ready to review: 18 filled')).toBeTruthy();
    expect(screen.getByText('Needs you: 3 to check')).toBeTruthy();
    expect(screen.getByText('1 submitted')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /submit/i })).toBeNull();
    await userEvent.click(screen.getAllByRole('button', { name: 'Review' })[0]!);
    expect(sent).toEqual([{ type: 'wera:queue-focus', tabId: 11 }]);
  });
});
