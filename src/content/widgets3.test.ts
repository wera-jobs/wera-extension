import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FillResult } from '../shared/types';
import { collectFields } from './fields';
import { enterValue, insertText } from './fill';
import { currentValue } from './plan';

const res = (): FillResult => ({ id: 'x', label: '', purpose: null, status: 'review', required: false });
const field = (label: string) => collectFields(document).find((f) => f.label.startsWith(label))!;

afterEach(() => vi.unstubAllGlobals());

describe('widgets newer forms use (#245)', () => {
  it('a rich-text editor is an open question Wera fills, and the Wera button inserts into', async () => {
    document.body.innerHTML = `<form><label id="q">Why do you want to join Acme?</label><div contenteditable="true" aria-labelledby="q" class="ql-editor"><p><br></p></div></form>`;
    const f = field('Why do you want to join Acme?');
    expect(f).toMatchObject({ kind: 'textarea', inputType: 'richtext' });
    const r = res();
    await enterValue(f, 'question', 'I keep robots running.', r);
    expect(r.status).toBe('filled');
    expect(currentValue(f)).toBe('I keep robots running.');
    expect(insertText(f.el, 'Another answer.')).toBe(true);
    expect(f.el.textContent).toBe('Another answer.');
  });

  it('ARIA checkboxes: a lone one is ticked for yes; a group is one question', async () => {
    document.body.innerHTML = `<form>
      <button type="button" role="checkbox" aria-checked="false" aria-label="I am willing to relocate" id="r"></button>
      <div role="group" aria-label="Which tools have you used?">
        <button type="button" role="checkbox" aria-checked="false">Python</button>
        <button type="button" role="checkbox" aria-checked="false">SQL</button>
        <button type="button" role="checkbox" aria-checked="false">Go</button></div></form>`;
    for (const b of document.querySelectorAll<HTMLElement>('[role=checkbox]')) b.addEventListener('click', () => b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true')));
    const lone = field('I am willing to relocate');
    expect(lone.kind).toBe('checkbox');
    const r1 = res();
    await enterValue(lone, null, 'yes', r1);
    expect(r1.status).toBe('filled');
    const group = field('Which tools have you used?');
    expect(group.kind).toBe('checkboxes');
    const r2 = res();
    await enterValue(group, 'skills', 'Python, Go', r2);
    expect(currentValue(group)).toBe('Python | Go');
  });

  it('a search box is a field only when it is a dropdown\'s search', () => {
    document.body.innerHTML = `<form><label for="s">Search jobs</label><input type="search" id="s">
      <label for="c">School</label><input type="search" id="c" role="combobox" aria-autocomplete="list"></form>`;
    expect(collectFields(document).map((f) => [f.label, f.kind])).toEqual([['School', 'combobox']]);
  });

  it('a row of three choice buttons is one question', async () => {
    document.body.innerHTML = `<form><div><p>How do you want to work?</p><div class="segmented-control">
      <button type="button">Remote</button><button type="button">Hybrid</button><button type="button">On-site</button></div></div></form>`;
    for (const b of document.querySelectorAll<HTMLElement>('button')) b.addEventListener('click', () => b.setAttribute('aria-pressed', 'true'));
    const f = field('How do you want to work?');
    expect(f).toMatchObject({ kind: 'buttons' });
    expect(f.options.map((o) => o.label)).toEqual(['Remote', 'Hybrid', 'On-site']);
    const r = res();
    await enterValue(f, 'work_preference', 'Hybrid', r);
    expect(r.value).toBe('Hybrid');
  });

  it('a toolbar of actions is no question', () => {
    document.body.innerHTML = '<form><div><p>Your resume</p><div><button type="button">Upload</button><button type="button">Remove</button></div></div></form>';
    expect(collectFields(document)).toEqual([]);
  });

  it('reads fields inside closed shadow roots, which the extension may open', () => {
    const host = document.createElement('x-form');
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = '<label for="e">Email</label><input id="e" type="email">';
    document.body.replaceChildren(host);
    vi.stubGlobal('chrome', { dom: { openOrClosedShadowRoot: (el: HTMLElement) => (el === host ? root : null) } });
    expect(collectFields(document).map((f) => f.label)).toEqual(['Email']);
  });

  it('pages with icons still read: Chrome throws for an element that cannot host a root', () => {
    const host = document.createElement('x-form');
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = '<label for="e">Email</label><input id="e" type="email">';
    document.body.innerHTML = '<svg><path d="M0 0"></path></svg><input type="text" aria-label="Phone">';
    document.body.append(host);
    // Chrome's chrome.dom.openOrClosedShadowRoot rejects an SVG element or an <input> outright.
    vi.stubGlobal('chrome', { dom: { openOrClosedShadowRoot: (el: Element) => {
      if (!(el instanceof HTMLElement) || el.localName === 'input') throw new TypeError('Error in invocation of dom.openOrClosedShadowRoot');
      return el === host ? root : null;
    } } });
    expect(collectFields(document).map((f) => f.label)).toEqual(['Phone', 'Email']);
  });
});

describe('banners', () => {
  it('a cookie banner\'s buttons are no question', () => {
    document.body.innerHTML = `<form><div class="banner"><p>Cookies: we use cookies to ensure you get the best experience.</p><div role="group">
      <button type="button">Accept all</button><button type="button">Reject</button><button type="button">Settings</button></div></div></form>`;
    expect(collectFields(document)).toEqual([]);
  });
});
