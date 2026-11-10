import { describe, expect, it } from 'vitest';
import type { FieldPlan, FieldSnapshot } from './types';
import { answersToLearn, worthRemembering } from './learn';

const plan = (id: string, label: string, over: Partial<FieldPlan> = {}): FieldPlan => ({
  id, label, purpose: null, kind: 'text', options: [], required: false, current: '', value: '', source: null, group: 'other', ...over,
});
const snap = (id: string, value: string, kind = 'text', label = ''): FieldSnapshot => ({ id, label, purpose: null, kind, value });

const fields = [
  plan('a', 'Favorite tool *'),
  plan('b', 'Why us?', { group: 'questions', purpose: 'question', kind: 'textarea' }),
  plan('c', 'Phone', { group: 'details', purpose: 'phone' }),
  plan('d', 'Gender', { group: 'self_id', purpose: 'gender', kind: 'select' }),
  plan('e', 'I agree', { group: 'consent', purpose: 'consent', kind: 'checkbox' }),
  plan('f', 'Clearance level', { kind: 'select' }),
  plan('g', 'Short why', { group: 'questions', purpose: 'question', kind: 'textarea' }),
  plan('h', 'Willing to travel?', { group: 'details', purpose: 'willing_to_travel', kind: 'radio' }),
  plan('i', 'Full name', { group: 'details', purpose: 'full_name' }),
];

describe('answersToLearn', () => {
  it('keeps answers to questions and unknown fields only', () => {
    const got = answersToLearn(fields, [
      snap('a', 'Terraform'), snap('b', 'Because you build reliable robots at scale.', 'textarea'), snap('c', '512 555 0142'),
      snap('d', 'Female', 'select'), snap('e', 'yes', 'checkbox'), snap('f', 'Secret', 'select'), snap('g', 'Robots.', 'textarea'),
      snap('zz', 'gone'),
    ], [{ question: 'Clearance level', answer: 'Secret', company: '', at: 1 }], 'Acme');
    expect(got).toEqual([
      { question: 'Favorite tool', answer: 'Terraform', kind: 'text', company: 'Acme' },
      { question: 'Why us?', answer: 'Because you build reliable robots at scale.', kind: 'long', company: 'Acme' },
    ]);
  });
});

describe('worthRemembering', () => {
  // Labels the main user's forms taught Wera by 2026-11-10 that mean nothing on the next form.
  it.each([
    ['594', 'LinkedIn', 'choice'],
    ['Comments', 'This role sounds exciting', 'long'],
    ['Please Specify', 'Vestas.com', 'text'],
    ['Make My Profile Visible to:', '1', 'choice'],
    ['English UK (English UK)', 'English UK (English UK)', 'choice'],
    ['Yes Required', 'Yes', 'choice'],
    ['Opt-In Required', 'Yes', 'choice'],
    ['End date', '05/2024', 'text'],
    ['Position title', 'Systems Administrator', 'text'],
    ['Current position?', 'Yes', 'choice'],
    ['Length of use (Years)', '2', 'choice'],
  ] as const)('drops %s', (label, value, kind) => {
    expect(worthRemembering(label, value, kind, false)).toBe(false);
  });
  it('drops a label repeated on the page: a row of a table', () => {
    expect(worthRemembering('Skill level', '4', 'choice', true)).toBe(false);
  });
  it.each([
    ['Do you have a non-compete agreement with a current or former employer?', 'No', 'choice'],
    ['What percentage of the time are you willing to travel?', '100', 'choice'],
    ['Favorite tool', 'Terraform', 'text'],
    ['How did you hear about us?', 'LinkedIn', 'choice'],
  ] as const)('keeps %s', (label, value, kind) => {
    expect(worthRemembering(label, value, kind, false)).toBe(true);
  });
  it('learns nothing from the rows of a skills table', () => {
    const rows = [plan('s1', 'Skill level', { kind: 'select' }), plan('s2', 'Skill level', { kind: 'select' })];
    expect(answersToLearn(rows, [snap('s1', '4', 'select'), snap('s2', '3', 'select')], [], 'Acme')).toEqual([]);
  });
});
