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
    box(flow, 0, 1440);
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
