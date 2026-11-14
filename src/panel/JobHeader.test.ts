import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { companyLogos, ownSite } from './JobHeader';

const page = (url: string, html: string) => new JSDOM(html, { url }).window.document;

describe("whose site a job page is on", () => {
  it('knows a company at home from a job board', () => {
    expect(ownSite('stripe.com', 'Stripe')).toBe(true);
    expect(ownSite('careers.palantir.com', 'Palantir Technologies')).toBe(true);
    expect(ownSite('www.metacareers.com', 'Meta')).toBe(true);
    expect(ownSite('jobs.lever.co', 'Palantir')).toBe(false);
    expect(ownSite('job-boards.greenhouse.io', 'Figma')).toBe(false);
    // Part of a name is not the name.
    expect(ownSite('jobs.lever.co', 'Cleverly')).toBe(false);
    expect(ownSite('x.com', 'X')).toBe(false);
  });
});

describe("where a company's logo may be", () => {
  it('takes the logo the job data names first', () => {
    const doc = page('https://jobs.example.com/1', '<script type="application/ld+json">{"@type":"JobPosting","hiringOrganization":{"name":"Acme","logo":"https://cdn.example.com/acme.png"}}</script>');
    expect(companyLogos(doc, 'Acme')[0]).toBe('https://cdn.example.com/acme.png');
  });

  it("uses the site's own icons, largest first, on the company's own site", () => {
    const doc = page('https://careers.acme.com/jobs/1', '<link rel="icon" sizes="32x32" href="/i32.png"><link rel="apple-touch-icon" href="/touch.png"><link rel="icon" type="image/svg+xml" href="/mark.svg">');
    expect(companyLogos(doc, 'Acme')).toEqual([
      'https://careers.acme.com/mark.svg', 'https://careers.acme.com/touch.png', 'https://careers.acme.com/i32.png',
      'https://careers.acme.com/apple-touch-icon.png', 'https://careers.acme.com/favicon.ico',
    ]);
  });

  it("never offers a job board's own icon", () => {
    const doc = page('https://jobs.lever.co/acme/1', '<link rel="icon" href="/lever.png"><header><p>Acme</p></header>');
    expect(companyLogos(doc, 'Acme')).toEqual([]);
  });

  it("on a board, follows the header logo home for the company's icon", () => {
    const doc = page('https://jobs.lever.co/acme/1', '<link rel="icon" href="/lever.png"><header><a href="https://www.acme.com/"><img alt="Acme logo" src="https://cdn.lever.co/acme-wordmark.png"></a></header>');
    expect(companyLogos(doc, 'Acme')).toEqual(['https://cdn.lever.co/acme-wordmark.png', 'https://www.acme.com/apple-touch-icon.png', 'https://www.acme.com/favicon.ico']);
  });

  it('does not follow a header link that leaves for someone else', () => {
    const doc = page('https://jobs.lever.co/acme/1', '<header><a href="https://www.lever.co/"><img alt="Acme logo" src="https://cdn.lever.co/a.png"></a></header>');
    expect(companyLogos(doc, 'Acme')).toEqual(['https://cdn.lever.co/a.png']);
  });
});
