import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeraApi } from '../shared/api';
import { referralQuestion, referralSearches, Referrals, roleOf } from './Referrals';

afterEach(cleanup);

const me = {
  education: [{ school: 'University of Texas at Austin' }, { school: 'University of Texas at Austin' }, { school: 'Austin Community College' }],
  experience: [
    { title: 'SRE', company: 'Globex', current: true },
    { title: 'Intern', company: 'Acme', current: false },
    { title: 'Ops', company: 'Initech', current: false },
    { title: 'Ops', company: 'Hooli', current: false },
  ],
};

describe('referralSearches', () => {
  it('starts with schoolmates, then former colleagues, then recruiters and the role', () => {
    const s = referralSearches('Acme', 'Site Reliability Engineer', me);
    expect(s.map((x) => x.label)).toEqual([
      'University of Texas at Austin alumni at Acme',
      'Austin Community College alumni at Acme',
      'Former Globex people at Acme',
      'Former Initech people at Acme',
      'Recruiters at Acme',
      'Site Reliability Engineer people at Acme',
    ]);
    expect(s[0]!.url).toBe('https://www.linkedin.com/search/results/people/?keywords=Acme%20University%20of%20Texas%20at%20Austin&origin=GLOBAL_SEARCH_HEADER');
  });

  it('still helps without a profile, and needs a company', () => {
    expect(referralSearches('Acme', 'SRE', null).map((x) => x.label)).toEqual(['Recruiters at Acme', 'SRE people at Acme']);
    expect(referralSearches('', 'SRE', me)).toEqual([]);
  });

  it.each([
    ['Account Executive - Commercial, Spotify Technology', 'Spotify', 'Account Executive'],
    ['Senior SRE (Platform)', 'Acme', 'Senior SRE'],
    ['Acme Software Engineer', 'Acme', 'Software Engineer'],
    ['Data Scientist | Ads', 'Acme', 'Data Scientist'],
    ['Engineer II, Data Platform', 'Acme', 'Engineer II'],
  ])('names the role in %s', (title, company, want) => {
    expect(roleOf(title, company)).toBe(want);
  });

  it('asks for a note that invents nothing', () => {
    expect(referralQuestion('Acme', 'SRE')).toMatch(/under 300 characters.*Acme.*SRE.*Do not invent/s);
  });
});

describe('Referrals', () => {
  it('lists the searches and writes a note to copy', async () => {
    const answer = vi.fn(async () => ({ answer: 'Hi [Name], I am applying for the SRE role at Acme...' }));
    const api = { applicant: vi.fn(async () => ({ applicant: {}, saved: true, sources: {}, skills: [], ...me })), answer } as unknown as WeraApi;
    render(<Referrals api={api} jobId={7} company="Acme" title="SRE" description="Run things." />);
    fireEvent.click(screen.getByRole('button', { name: /Find someone to refer you/ }));
    expect(await screen.findByRole('link', { name: /University of Texas at Austin alumni at Acme/ })).toHaveAttribute('target', '_blank');
    fireEvent.click(screen.getByRole('button', { name: /Write a note to send/ }));
    expect(await screen.findByLabelText('Your note')).toHaveValue('Hi [Name], I am applying for the SRE role at Acme...');
    expect(answer).toHaveBeenCalledWith(expect.stringContaining('referring me for the SRE role'), 7, 60, { company: 'Acme', title: 'SRE', description: 'Run things.' });
  });

  it('says so when no note comes back', async () => {
    const api = { applicant: vi.fn(async () => { throw new Error('offline'); }), answer: vi.fn(async () => ({ needs_input: 'Finish your profile first.' })) } as unknown as WeraApi;
    render(<Referrals api={api} jobId={null} company="Acme" title="SRE" description="" />);
    fireEvent.click(screen.getByRole('button', { name: /Find someone to refer you/ }));
    expect(screen.getByRole('link', { name: /Recruiters at Acme/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Write a note to send/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Finish your profile first.');
  });
});
