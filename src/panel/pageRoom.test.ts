import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeRoom } from './pageRoom';

const box = (el: Element, left: number, right: number) =>
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ left, right, width: right - left, height: 40, top: 0, bottom: 40, x: left, y: 0, toJSON: () => ({}) });

describe('makeRoom', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('style');
    vi.restoreAllMocks();
  });

  it('moves the page over, and puts the margin back when the site wipes it (Greenhouse redraws <html>)', async () => {
    document.documentElement.style.setProperty('margin-right', '10px');
    const undo = makeRoom(document, 396);
    expect(document.documentElement.style.getPropertyValue('margin-right')).toBe('396px');
    document.documentElement.removeAttribute('style');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.documentElement.style.getPropertyValue('margin-right')).toBe('396px');
    undo();
    expect(document.documentElement.style.getPropertyValue('margin-right')).toBe('10px');
  });

  it('narrows a fixed bar across the window and moves a corner button left of the panel (Lever\'s header holds Apply)', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440);
    document.body.innerHTML = '<header id="bar" style="position:fixed;left:0;right:0"></header><div id="chat" style="position:fixed;right:20px"></div><div id="flow"></div>';
    const bar = document.getElementById('bar')!, chat = document.getElementById('chat')!, flow = document.getElementById('flow')!;
    box(bar, 0, 1440);
    box(chat, 1360, 1420);
    // In the flow, so already narrowed by the margin.
    box(flow, 0, 1044);
    const undo = makeRoom(document, 396);
    // Browsers (and jsdom 31) may write the calc in canonical order: either spelling is the same width.
    expect(bar.style.getPropertyValue('max-width')).toMatch(/^calc\((100vw - 396px|-396px \+ 100vw)\)$/);
    expect(chat.style.getPropertyValue('right')).toBe('416px');
    expect(flow.getAttribute('style')).toBeNull();
    undo();
    expect(bar.style.getPropertyValue('max-width')).toBe('');
    expect(chat.style.getPropertyValue('right')).toBe('20px');
  });
});

describe('makeRoom on pages that cannot narrow', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
    vi.restoreAllMocks();
  });

  it('scales the page into the room when a fixed-width layout would stay under the panel (Framer, bunq)', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440);
    document.body.innerHTML = '<div id="page" style="position:relative;min-width:1280px"></div><div id="chat" style="position:fixed;right:20px"></div>';
    const page = document.getElementById('page')!, chat = document.getElementById('chat')!;
    box(document.documentElement, 0, 1044);
    box(page, 0, 1440);
    box(chat, 1360, 1420);
    const undo = makeRoom(document, 396);
    expect(document.body.style.getPropertyValue('zoom')).toBe('0.725');
    // Offsets inside the scaled page are drawn smaller, so they are set larger.
    expect(parseFloat(chat.style.getPropertyValue('right'))).toBeCloseTo(20 + 396 / 0.725, 2);
    undo();
    expect(document.body.style.getPropertyValue('zoom')).toBe('');
    expect(chat.style.getPropertyValue('right')).toBe('20px');
  });

  it('leaves a page that fits at its size', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440);
    document.body.innerHTML = '<div id="page"></div><div id="carousel" style="position:absolute"></div>';
    box(document.documentElement, 0, 1044);
    box(document.getElementById('page')!, 0, 1044);
    box(document.getElementById('carousel')!, 0, 5760);
    makeRoom(document, 396)();
    expect(document.body.getAttribute('style')).toBeNull();
  });

  it('does not count a wide bar inside something lifted out of the flow (Lever\'s notice bar)', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440);
    document.body.innerHTML = '<div style="position:fixed"><div id="notice"></div></div>';
    box(document.documentElement, 0, 1044);
    box(document.getElementById('notice')!, 0, 1440);
    makeRoom(document, 396)();
    expect(document.body.getAttribute('style')).toBeNull();
  });

  it('moves a fixed Apply bar under the panel however deep it sits, above the content it lands on (Dropbox)', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440);
    document.body.innerHTML = '<div><div><div><div><div><div><aside id="side" style="position:fixed;right:24px"><a id="apply">Apply</a></aside></div></div></div></div></div></div>';
    const side = document.getElementById('side')!;
    box(side, 1260, 1416);
    Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: (x: number) => (x > 1260 ? [document.getElementById('apply')!] : []) });
    // Where it lands, the page's own image is on top.
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => document.body.firstElementChild });
    try {
      const undo = makeRoom(document, 396);
      expect(side.style.getPropertyValue('right')).toBe('420px');
      expect(side.style.getPropertyValue('z-index')).toBe('2147483000');
      undo();
      expect(side.style.getPropertyValue('right')).toBe('24px');
      expect(side.style.getPropertyValue('z-index')).toBe('');
    } finally {
      delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
      delete (document as { elementFromPoint?: unknown }).elementFromPoint;
    }
  });
});

describe('makeRoom when the site replaces <html>', () => {
  it('gives the new root the margin too', async () => {
    const undo = makeRoom(document, 396);
    const fresh = document.createElement('html');
    fresh.append(document.createElement('head'), document.createElement('body'));
    document.replaceChild(fresh, document.documentElement);
    await new Promise((r) => setTimeout(r, 0));
    expect(document.documentElement.style.getPropertyValue('margin-right')).toBe('396px');
    undo();
    expect(document.documentElement.style.getPropertyValue('margin-right')).toBe('');
  });
});
