import { describe, expect, it } from 'vitest';
import type { FillResult } from '../shared/types';
import { collectFields } from './fields';
import { enterValue, schoolSearches } from './fill';

const res = (): FillResult => ({ id: 'x', label: '', purpose: null, status: 'review', required: false });

/** Greenhouse's school box: a react-select that asks a server, answering after a delay. */
function schoolBox(schools: string[], delay = 1500) {
  document.body.innerHTML = `<form><label for="s">School</label><div class="select__control"><input id="s" role="combobox" aria-controls="sl" aria-autocomplete="list"><div id="shown"></div></div>
    <div id="sl" role="listbox"></div><label for="n">Name</label><input id="n"></form>`;
  const input = document.querySelector<HTMLInputElement>('#s')!;
  const list = document.querySelector('#sl')!;
  let timer = 0;
  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    list.innerHTML = '<div role="option">Loading...</div>';
    const q = input.value.toLowerCase();
    timer = window.setTimeout(() => {
      const hits = schools.filter((s) => s.toLowerCase().includes(q));
      list.innerHTML = hits.map((s) => `<div role="option">${s}</div>`).join('') || '<div class="select__menu-notice--no-options">No options</div>';
      list.querySelectorAll<HTMLElement>('[role=option]').forEach((o) => o.addEventListener('click', () => {
        document.querySelector('#shown')!.innerHTML = `<div class="select__single-value">${o.textContent}</div>`;
        list.innerHTML = '';
      }));
    }, delay);
  });
  return collectFields(document).find((f) => f.label === 'School')!;
}

describe('schools in a list that searches a server', () => {
  it('searches the telling words of a name', () => {
    expect(schoolSearches('The University of Texas at Dallas')).toEqual(['The University of Texas at Dallas', 'University of Texas at Dallas', 'Texas at Dallas', 'Texas Dallas']);
    expect(schoolSearches('Princeton University')).toEqual(['Princeton University', 'Princeton']);
  });

  it('waits for slow results, and finds the school under another wording', async () => {
    const f = schoolBox(['Princeton Theological Seminary', 'Princeton University'], 1500);
    const r = res();
    await enterValue(f, 'edu_school', 'Princeton University', r);
    expect(r).toMatchObject({ status: 'filled', value: 'Princeton University' });
  }, 20000);

  it('chooses Other for a school the list lacks, and says to type it', async () => {
    const f = schoolBox(['Princeton University', 'Other'], 50);
    const r = res();
    await enterValue(f, 'edu_school', 'Example State University', r);
    expect(r.value).toBe('Other');
    expect(r.status).toBe('review');
    expect(r.note).toMatch(/not in the list, so Wera chose Other/);
  }, 30000);
});
