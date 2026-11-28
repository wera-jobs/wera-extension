import { describe, expect, it } from 'vitest';
import type { Profile } from '../shared/types';
import { derivedAnswer, yearsAsked, yearsWorked } from './derived';
import { planForm } from './plan';

const alex = { city: 'San Francisco', state: 'CA', country: 'United States', years_experience: '3', work_preference: 'hybrid', experience: [], education: [] } as unknown as Profile;
const ans = (q: string, a: Profile = alex, jobLocation = 'San Francisco, California') => derivedAnswer(q, a, { jobLocation })?.value ?? null;

describe('questions the data settles (live forms, Nov 28)', () => {
  it('reads the years a question asks for', () => {
    expect(yearsAsked('Do you have a minimum of 7 years of experience building software?')).toBe(7);
    expect(yearsAsked('5+ years of Python?')).toBe(5);
    expect(yearsAsked('Do you have at least three years of professional experience?')).toBe(3);
    expect(yearsAsked('Do you have 2 or more years in sales?')).toBe(2);
    expect(yearsAsked('Have you used Robinhood?')).toBeNull();
  });

  it('counts years from the resume when the details do not say, overlaps once', () => {
    const p = { experience: [{ start: '2019-01', end: '2021-01' }, { start: '2020-01', end: '2022-01' }] } as unknown as Profile;
    expect(yearsWorked(p, new Date(2026, 0, 1))).toBe(3);
  });

  it('Ramp: fewer years than asked is a sure no, with or without a named tool', () => {
    expect(ans('Do you have a minimum of 7 years of experience building software?')).toBe('No');
    expect(ans('Do you have a minimum of 5 years of experience building in AWS (with Terraform)?')).toBe('No');
  });

  it('enough years is a yes only for experience in general, never for one tool', () => {
    const senior = { ...alex, years_experience: '8' } as Profile;
    expect(ans('Do you have at least 5 years of professional experience?', senior)).toBe('Yes');
    expect(ans('Do you have a minimum of 7 years of experience building software?', senior)).toBe('Yes');
    expect(ans('Do you have a minimum of 5 years of experience building in AWS (with Terraform)?', senior)).toBeNull();
  });

  it('Notion and OpenAI: office days in the city the user lives in', () => {
    expect(ans('We work from our offices on Mondays, Tuesdays, and Thursdays (Anchor Days). Are you able to commit to working from our offices on Anchor Days?')).toBe('Yes');
    expect(ans('Are you able to work from our US office three days per week?')).toBe('Yes');
    expect(ans('Are you able to work from our New York office three days per week?')).toBeNull();
    expect(ans('Are you able to work from our US office three days per week?', { ...alex, work_preference: 'remote' })).toBeNull();
  });

  it('where the user lives; a timezone question stays with the AI (Linear)', () => {
    expect(ans('Are you currently located in the US?')).toBe('Yes');
    expect(ans('Are you currently located in the US?', { ...alex, country: 'Kenya', city: 'Nairobi' })).toBe('No');
    expect(ans('Are you based in a EU or equivalent timezone?')).toBeNull();
  });

  it('fills the yes/no in the plan, with the reason', () => {
    document.body.innerHTML = `<form><fieldset><legend>Do you have a minimum of 7 years of experience building software?</legend>
      <label><input type="radio" name="y" value="1">Yes</label><label><input type="radio" name="y" value="0">No</label></fieldset></form>`;
    const f = planForm(document, alex, { jobLocation: 'New York, NY' }).fields[0]!;
    expect(f).toMatchObject({ value: 'No', source: 'profile', note: 'from your details: you have 3 years of experience' });
  });
});
