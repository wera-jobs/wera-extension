import { describe, expect, it } from 'vitest';
import { collectFields } from './fields';
import { enterValue } from './fill';
import type { FillResult } from '../shared/types';

const res = (): FillResult => ({ id: 'x', label: '', purpose: null, status: 'review', required: false });

describe('custom dropdowns', () => {
  it('Ant Design: the input clears and the choice shows beside it; no second click to undo it', async () => {
    document.body.innerHTML = `<form><div class="ant-select"><label for="c">Country</label>
      <div class="ant-select-selector"><span class="ant-select-selection-search"><input id="c" role="combobox" aria-controls="cl" aria-expanded="false"></span><span id="shown"></span></div>
      <div id="cl" role="listbox"></div></div><label for="n">Name</label><input id="n"></form>`;
    const input = document.querySelector<HTMLInputElement>('#c')!;
    const list = document.querySelector('#cl')!;
    let picks = 0;
    const open = () => {
      list.innerHTML = ['Canada', 'Kenya', 'United States'].map((c) => `<div role="option">${c}</div>`).join('');
      list.querySelectorAll<HTMLElement>('[role=option]').forEach((o) => o.addEventListener('click', () => {
        picks++;
        // A toggle: a second click takes it back.
        document.querySelector('#shown')!.innerHTML = picks % 2 ? `<span class="ant-select-selection-item">${o.textContent}</span>` : '';
        input.value = '';
        list.innerHTML = '';
      }));
    };
    input.addEventListener('keyup', open);
    input.addEventListener('input', open);
    const f = collectFields(document).find((x) => x.el === input)!;
    const r = res();
    await enterValue(f, 'country', 'Kenya', r);
    expect(r.status).toBe('filled');
    expect(picks).toBe(1);
    expect(document.querySelector('.ant-select-selection-item')!.textContent).toBe('Kenya');
  });

  it('scrolls a long list that draws only the rows in view', async () => {
    document.body.innerHTML = `<form><label for="s">State</label><button id="s" type="button" aria-haspopup="listbox" aria-controls="sl">Select</button>
      <div id="sl" role="listbox" style="overflow-y: auto"></div><label for="n">Name</label><input id="n"></form>`;
    const list = document.querySelector<HTMLElement>('#sl')!;
    const states = Array.from({ length: 50 }, (_, i) => `State ${String(i).padStart(2, '0')}`);
    let top = 0;
    Object.defineProperty(list, 'scrollHeight', { get: () => 50 * 20 });
    Object.defineProperty(list, 'clientHeight', { get: () => 200 });
    Object.defineProperty(list, 'scrollTop', { get: () => top, set: (v: number) => { top = v; draw(); } });
    const draw = () => {
      const first = Math.floor(top / 20);
      list.innerHTML = states.slice(first, first + 10).map((s) => `<div role="option">${s}</div>`).join('');
      list.querySelectorAll<HTMLElement>('[role=option]').forEach((o) => o.addEventListener('click', () => (document.querySelector('#s')!.textContent = o.textContent)));
    };
    document.querySelector('#s')!.addEventListener('click', draw);
    const f = collectFields(document).find((x) => x.label === 'State')!;
    const r = res();
    await enterValue(f, null, 'State 42', r);
    expect(r.status).toBe('filled');
    expect(document.querySelector('#s')!.textContent).toBe('State 42');
  });
});
