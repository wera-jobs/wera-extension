import { describe, expect, it } from 'vitest';
import type { Profile } from '../shared/types';
import { WORKDAY, wireWorkday } from './__fixtures__/workday';
import { applyItems, planForm } from './plan';
import { parsePhone } from './phone';

const me = { first_name: 'Jesse', last_name: 'C', email: 'j@example.com', phone: '+1 (469) 555-0101', country: 'United States', city: 'Dallas', state: 'TX', experience: [], education: [], skills: [] } as unknown as Profile;
const value = (purpose: string) => planForm(document, me).fields.find((f) => f.purpose === purpose)?.value;

describe('phone numbers', () => {
  it('reads a saved number by its own code, else as one of the user\'s country', () => {
    expect(parsePhone('+1 (469) 555-0101')).toMatchObject({ national: '4695550101', calling: '1', region: 'US' });
    expect(parsePhone('1-469-555-0101', 'United States')).toMatchObject({ national: '4695550101', calling: '1' });
    expect(parsePhone('0712 345 678', 'Kenya')).toMatchObject({ national: '712345678', calling: '254', region: 'KE' });
    expect(parsePhone('469 555 0101 x204')).toMatchObject({ national: '4695550101', ext: '204' });
    expect(parsePhone('n/a')).toBeNull();
  });

  it('Workday: the code in its list, the national number alone in the box', async () => {
    document.body.innerHTML = WORKDAY;
    wireWorkday(document);
    const { fields } = planForm(document, me);
    const items = fields.filter((f) => /phone/i.test(f.label) && f.value).map((f) => ({ id: f.id, value: f.value }));
    const out = await applyItems(document, items);
    expect(out.every((r) => r.status === 'filled')).toBe(true);
    expect(document.querySelector<HTMLInputElement>('#ph')!.value).toBe('4695550101');
  });

  it('a flag picker beside the box (Greenhouse, intl-tel-input) takes the code, the box the rest', () => {
    document.body.innerHTML = `<form><div class="phone-input"><div class="select"><button type="button" aria-label="Country: United States +1">🇺🇸 +1</button></div>
      <label for="p">Phone</label><input id="p" type="tel"></div><label for="n">Name</label><input id="n"><label for="e">Email</label><input id="e"></form>`;
    expect(value('phone')).toBe('4695550101');
  });

  it('a lone phone box keeps the whole number', () => {
    document.body.innerHTML = '<form><label for="p">Phone</label><input id="p" type="tel"></form>';
    expect(value('phone')).toBe('+1 (469) 555-0101');
  });

  it('the country code follows the number, not where the user lives', () => {
    document.body.innerHTML = WORKDAY;
    wireWorkday(document);
    const kenyan = { ...me, phone: '+254 712 345 678' } as Profile;
    const { fields } = planForm(document, kenyan);
    expect(fields.find((f) => f.purpose === 'phone_code')?.value).toBe('Kenya');
    expect(fields.find((f) => f.purpose === 'phone')?.value).toBe('712345678');
  });
});
