import { describe, expect, it } from 'vitest';
import { applyItems, isApplying, planForm, stopFilling } from './plan';

const form = () => {
  document.body.innerHTML = `<form><label for="a">First name</label><input id="a"><label for="b">Last name</label><input id="b">
    <label for="c">City</label><input id="c"><label for="d">Email</label><input id="d" type="email"></form>`;
  return planForm(document, { first_name: 'Ada' } as never).fields.map((f) => f.id);
};

describe('fills in one frame', () => {
  it('run one after another, and Wera counts as filling until the last ends', async () => {
    const [a, b, c, d] = form();
    const order: string[] = [];
    const one = applyItems(document, [{ id: a!, value: 'Ada' }, { id: b!, value: 'Byrne' }], { pace: 20, onProgress: (r) => order.push(r.id) });
    const two = applyItems(document, [{ id: c!, value: 'Dallas' }, { id: d!, value: 'ada@example.com' }], { onProgress: (r) => order.push(r.id) });
    expect(isApplying()).toBe(true);
    await one;
    expect(isApplying()).toBe(true);
    await two;
    expect(isApplying()).toBe(false);
    expect(order).toEqual([a, b, c, d]);
  });

  it('Stop ends every fill queued before it, and a later fill still runs', async () => {
    const [a, b, c] = form();
    const one = applyItems(document, [{ id: a!, value: 'Ada' }, { id: b!, value: 'Byrne' }], { pace: 30 });
    const two = applyItems(document, [{ id: c!, value: 'Dallas' }]);
    await new Promise((r) => setTimeout(r, 10));
    stopFilling();
    const [r1, r2] = await Promise.all([one, two]);
    expect(r1.map((r) => r.status)).toEqual(['filled', 'skipped']);
    expect(r2.map((r) => r.status)).toEqual(['skipped']);
    const three = await applyItems(document, [{ id: c!, value: 'Austin' }]);
    expect(three[0]!.status).toBe('filled');
    expect((document.querySelector('#c') as HTMLInputElement).value).toBe('Austin');
  });
});
