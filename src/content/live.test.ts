// What the nightly live test found on real forms, kept fixed.
import { describe, expect, it } from 'vitest';
import { classify } from './classify';
import { collectFields } from './fields';
import { matchOption } from './match';

const options = (labels: string[]) => labels.map((label) => ({ label, value: label }));

describe('Robinhood on Greenhouse (live test, Nov 28)', () => {
  const worked = options([
    'I currently work at Robinhood as a full-time employee or intern',
    'I have previously worked at Robinhood as a full-time employee or intern (Hoodie Alumni)',
    'I currently work at Robinhood in a contractor role',
    'I have previously worked at Robinhood in a contractor role',
    'I have never worked at Robinhood',
  ]);

  it('"never worked here" is the no among several ways of saying yes; a yes is left to the person', () => {
    expect(matchOption(worked, 'no', 'previously_employed')?.label).toBe('I have never worked at Robinhood');
    expect(matchOption(worked, 'yes', 'previously_employed')).toBeNull();
  });

  it('"What is your military status?" is the veteran question, and never-served is a non-veteran', () => {
    document.body.innerHTML = '<form><label for="m">What is your military status?*</label><select id="m" required><option></option><option>I have never served in the military</option></select></form>';
    expect(collectFields(document).map((f) => classify(f))).toEqual(['veteran']);
    const military = options(['I am on active duty', 'I am part of the national guard or on reserve', 'I have never served in the military',
      'I identify as a protected veteran', 'I identify as a non-protected veteran', 'I identify in multiple military status categories', "I don't wish to answer"]);
    expect(matchOption(military, 'I am not a veteran', 'veteran')?.label).toBe('I have never served in the military');
    expect(matchOption(military, 'I am a protected veteran', 'veteran')?.label).toBe('I identify as a protected veteran');
  });
});
