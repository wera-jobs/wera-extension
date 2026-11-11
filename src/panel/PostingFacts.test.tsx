import { describe, expect, it } from 'vitest';
import type { WeraJob } from '../shared/api';
import type { JobDraft } from '../shared/types';
import { postingFacts } from './PostingFacts';

const now = Date.parse('2026-11-04T12:00:00Z');
const ago = (days: number) => new Date(now - days * 86_400_000).toISOString();
const job = (over: Partial<WeraJob>): WeraJob => ({
  id: 1, company: 'Acme', title: 'SRE', url: 'u', location_raw: null, location_summary: null, stage: 'scored',
  fit_score: 80, estimated_score: null, verdict: null, reason: null, sponsorship: null, skills_matched: null,
  skills_missing: null, application_status: null, source: 'greenhouse', first_seen_at: ago(1), ...over,
});
const draft = (over: Partial<JobDraft>): JobDraft => ({
  url: 'u', company: 'Acme', title: 'SRE', location: '', work_mode: '', employment_type: '', department: '',
  salary: '', industry: '', description: '', source: 'page-data', ...over,
});

describe('postingFacts', () => {
  it('takes the posting date over when Wera found it, and the pay from the job data', () => {
    const f = postingFacts(job({ posted_at: ago(10) }), draft({ salary: '$150,000 - 200,000 per year' }), '', now);
    expect(f).toEqual({ pay: '$150K – $200K a year', age: 10, warning: '' });
  });

  it('reads the pay from the page when the job data has none', () => {
    expect(postingFacts(null, null, 'About us. The hourly pay range is $25 - $30.', now).pay).toBe('$25 – $30 an hour');
  });

  it('says when Wera saw the job come down', () => {
    expect(postingFacts(job({ closed_at: ago(3) }), null, '', now).warning).toMatch(/last found this job on Acme's job board 3 days ago/);
  });

  it('says when the job data has expired, and not before', () => {
    expect(postingFacts(null, draft({ expires: ago(14) }), '', now).warning).toMatch(/stopped taking applications 2 weeks ago/);
    expect(postingFacts(null, draft({ expires: ago(-30) }), '', now).warning).toBe('');
  });

  it('warns about a posting up for months', () => {
    expect(postingFacts(null, draft({ posted: ago(120) }), '', now).warning).toMatch(/^Posted 4 months ago\. Postings up this long/);
    expect(postingFacts(null, draft({ posted: ago(30) }), '', now).warning).toBe('');
  });
});
