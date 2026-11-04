import { describe, expect, it } from 'vitest';
import { ageWords, daysSince, payFromText, shortPay } from './facts';

describe('payFromText', () => {
  it.each([
    ['The base salary range for this role is $120,000 - $150,000.', '$120K – $150K a year'],
    ['Compensation: $165K–$210K + equity', '$165K – $210K a year'],
    ['Pay range: $25.50 to $31 per hour', '$25.50 – $31 an hour'],
    ['The hourly pay for this position is $22/hr.', '$22 an hour'],
    ['Salary Range: $95,000 to $112,500 USD per year', '$95K – $112.5K a year'],
    ['Annual salary: $80,000', '$80K a year'],
    ['Salary: $120-150K DOE', '$120K – $150K a year'],
    ['The proposed salary range for this position is:\n\n$86,600 - $181,800\n\nCACI is an Equal Opportunity Employer.', '$86.6K – $181.8K a year'],
    ['Salary Range $220,000.00 - $275,000.00 A successful applicant', '$220K – $275K a year'],
    ['Base pay rates will be between $110,000 and $190,000 per year.', '$110K – $190K a year'],
    ['Salary range is expected to be between $125,100.00 CAD - $175,100.00 CAD', 'CA$125.1K – CA$175.1K a year'],
    ['Salary range: $70,000 - $80,000 CAD per year.', 'CA$70K – CA$80K a year'],
  ])('reads %s', (text, want) => {
    expect(payFromText(text)).toBe(want);
  });

  it.each([
    'We raised $40 million in our Series B from great investors.',
    'Our customers process $2 billion in payments every year.',
    'We offer a $1,500 learning stipend and a 401(k) match.',
    'Includes a $500 home office allowance on top of your salary.',
    'Join a team of 50 engineers building payments.',
    'Annual revenue of $300,000,000 and growing.',
    'Pay your rent with $5 off.',
    'AECOM is a Fortune 500 firm that had revenue of $16.1 billion in fiscal year 2025.',
    'Project budgets will vary from $50K to $30M+.',
  ])('finds no pay in %s', (text) => {
    expect(payFromText(text)).toBe('');
  });

  it('takes the pay over funding mentioned earlier', () => {
    expect(payFromText('We raised $40M last year. The salary for this role is $140,000 - $160,000.')).toBe('$140K – $160K a year');
  });

  it('shortens the page data form', () => {
    expect(shortPay('$120,000 - $150,000 per year')).toBe('$120K – $150K a year');
    expect(shortPay('EUR 60,000 - 70,000')).toBe('EUR 60,000 - 70,000');
    expect(shortPay('')).toBe('');
  });
});

describe('posting age', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  it('counts days since a date', () => {
    expect(daysSince('2026-11-01T12:00:00Z', now)).toBe(3);
    expect(daysSince('2026-12-01', now)).toBeLessThan(0);
    expect(daysSince('not a date', now)).toBeNull();
    expect(daysSince(null, now)).toBeNull();
  });

  it.each([[0, 'today'], [1, 'yesterday'], [5, '5 days ago'], [21, '3 weeks ago'], [95, '3 months ago'], [400, 'a year ago'], [800, '2 years ago']])(
    '%i days reads as %s',
    (days, want) => {
      expect(ageWords(days)).toBe(want);
    },
  );
});
