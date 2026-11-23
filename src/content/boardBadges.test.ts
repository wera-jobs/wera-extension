import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { findBoardCards, quickSkillScore, renderBadge, watchBoardBadges } from './boardBadges';

describe('job-board search list fit badges (#146)', () => {
  it('extracts 20+ cards on LinkedIn, Indeed, and Glassdoor search lists', () => {
    const liHtml = Array.from({ length: 22 }, (_, i) =>
      `<li data-occludable-job-id="${1000 + i}"><a class="job-card-list__title" href="/jobs/view/${1000 + i}/">Engineer ${i}</a><div class="job-card-container__primary-description">Acme ${i}</div></li>`,
    ).join('');
    const liDoc = new JSDOM(`<!doctype html><ul>${liHtml}</ul>`, { url: 'https://www.linkedin.com/jobs/search/?keywords=go' }).window.document;
    const liCards = findBoardCards(liDoc);
    expect(liCards).toHaveLength(22);
    expect(liCards[0]).toMatchObject({ url: 'https://www.linkedin.com/jobs/view/1000/', title: 'Engineer 0', company: 'Acme 0' });

    const inDoc = new JSDOM(`<!doctype html><div class="job_seen_beacon" data-jk="abc123"><h2 class="jobTitle"><a class="jcs-JobTitle" href="/rc/clk?jk=abc123">SRE</a></h2><span data-testid="company-name">Globex</span></div>`, {
      url: 'https://www.indeed.com/jobs?q=sre',
    }).window.document;
    expect(findBoardCards(inDoc)[0]).toMatchObject({ url: 'https://www.indeed.com/viewjob?jk=abc123', title: 'SRE', company: 'Globex' });

    const gdDoc = new JSDOM(`<!doctype html><li data-test="jobListing" data-jobid="99"><a data-test="job-link" href="/job-listing/sre?jl=99"><span data-test="job-title">Staff SRE</span></a><span data-test="employer-short-name">Initech</span></li>`, {
      url: 'https://www.glassdoor.com/Job/sre-jobs.htm',
    }).window.document;
    expect(findBoardCards(gdDoc)[0]).toMatchObject({ url: 'https://www.glassdoor.com/job-listing/sre?jl=99', title: 'Staff SRE', company: 'Initech' });
  });

  it('computes a quick keyword score from resume skills when Wera has no copy of the job', () => {
    expect(quickSkillScore('Senior Go & PostgreSQL Backend Engineer (Docker, Kubernetes)', ['Go', 'PostgreSQL', 'Docker', 'Rust'])).toBeGreaterThanOrEqual(70);
    expect(quickSkillScore('Barista', ['Go', 'PostgreSQL'])).toBeNull();
  });

  it('renders fit badge and direct company apply link, and clears stale badges on recycled cards', async () => {
    const doc = new JSDOM(`<!doctype html><ul><li data-occludable-job-id="100"><a class="job-card-list__title" href="/jobs/view/100/">Backend Engineer</a><div class="job-card-container__primary-description">Acme</div></li></ul>`, {
      url: 'https://www.linkedin.com/jobs/search/?keywords=backend',
    }).window.document;
    Object.defineProperty(doc, 'hidden', { value: false, configurable: true });
    const [card] = findBoardCards(doc);
    renderBadge(card!, { key: card!.key, score: 86, source: 'wera', applyUrl: 'https://boards.greenhouse.io/acme/jobs/42' });
    expect(card!.el.textContent).toContain('Wera 86%');
    expect(card!.el.querySelector('a[href="https://boards.greenhouse.io/acme/jobs/42"]')).toBeTruthy();

    vi.stubGlobal('chrome', {
      runtime: {
        id: 'x',
        sendMessage: vi.fn(async () => [{ key: 'li:200:staff engineer', score: 72, source: 'keywords' }]),
      },
    });
    const stop = watchBoardBadges(doc, 5);
    // Simulate LinkedIn recycling the same <li> for a different job.
    card!.el.setAttribute('data-occludable-job-id', '200');
    card!.el.querySelector('a')!.textContent = 'Staff Engineer';
    card!.el.querySelector('a')!.setAttribute('href', '/jobs/view/200/');
    await vi.waitFor(() => expect(card!.el.textContent).toContain('Wera ~72%'));
    expect(card!.el.textContent).not.toContain('Wera 86%');
    stop();
    vi.unstubAllGlobals();
  });
});
