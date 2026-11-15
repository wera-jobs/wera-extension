import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { isHydrated, whenSettled } from './settled';

const doc = (html: string) => new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, { url: 'https://jobs.example.com/1' }).window.document;

describe('pages a script rebuilds in the browser', () => {
  it('knows apps that take over the whole document, and leaves the rest alone', () => {
    expect(isHydrated(doc('<script>window.__remixContext = {}</script>'))).toBe(true);
    expect(isHydrated(doc('<script>window.__reactRouterContext = {}</script>'))).toBe(true);
    expect(isHydrated(doc('<script>(self.__next_f=self.__next_f||[]).push([0])</script>'))).toBe(true);
    // Apps that start inside one element never look at the panel: no wait for them.
    expect(isHydrated(doc('<div id="__next"></div><link rel="modulepreload" href="/a.js">'))).toBe(false);
    expect(isHydrated(doc('<h1>Engineer</h1><form><input name="email"></form>'))).toBe(false);
  });

  it('lets a plain page have Wera at once', async () => {
    const at = Date.now();
    await whenSettled(doc('<h1>Engineer</h1>'));
    expect(Date.now() - at).toBeLessThan(50);
  });

  it('waits on a hydrated page until it has loaded, and no longer than the cap', async () => {
    const dom = new JSDOM('<!doctype html><body><script>window.__remixContext = {}</script></body>', { url: 'https://jobs.example.com/1' });
    // Past jsdom's own load event: from here the page is "still loading" until the test says so.
    await new Promise((r) => setTimeout(r, 20));
    const d = dom.window.document;
    Object.defineProperty(d, 'readyState', { value: 'interactive', configurable: true });
    vi.useFakeTimers();
    let settled = false;
    void whenSettled(d, 3000).then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(2000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1100);
    expect(settled).toBe(true);
    // The page loading settles it sooner.
    let early = false;
    void whenSettled(d, 3000).then(() => (early = true));
    dom.window.dispatchEvent(new dom.window.Event('load'));
    await vi.advanceTimersByTimeAsync(600);
    expect(early).toBe(true);
    vi.useRealTimers();
  });
});
