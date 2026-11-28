import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { couldBeJobPage, startDetector } from './index';

const probe = (url: string, html: string) => couldBeJobPage(new JSDOM(`<!doctype html><body>${html}`, { url }).window.document);

describe('lightweight page detector', () => {
  it('stays asleep on everyday non-job pages', () => {
    expect(probe('https://www.amazon.com/dp/B0D1XD1ZV3', '<h1>Wireless Earbuds</h1><button>Add to Cart</button>')).toBe(false);
    expect(probe('https://mail.google.com/mail/u/0/#inbox', '<p>Thank you for applying</p><input type="file">')).toBe(false);
    expect(probe('https://en.wikipedia.org/wiki/TypeScript', '<h1>TypeScript</h1><p>Programming language</p>')).toBe(false);
    expect(probe('https://www.linkedin.com/feed/', '<h1>Feed</h1><p>Posts</p>')).toBe(false);
    expect(probe('https://shop.example.com/checkout', '<form><input name="email"><input name="card"></form>')).toBe(false);
  });

  it('wakes the form engine on job URLs, ATS hosts, JobPosting JSON-LD, embedded ATS iframes, file uploads, and confirmations', () => {
    expect(probe('https://www.linkedin.com/jobs/view/4012345678/', '<h1>SRE</h1>')).toBe(true);
    expect(probe('https://acme.wd5.myworkdayjobs.com/en-US/Careers/login', '<h2>Sign In</h2>')).toBe(true);
    expect(probe('https://acme.com/careers/sre', '<h1>SRE</h1>')).toBe(true);
    expect(probe('https://acme.com/about', '<script type="application/ld+json">{"@type":"JobPosting","title":"SRE"}</script>')).toBe(true);
    expect(probe('https://acme.com/about', '<iframe src="https://job-boards.greenhouse.io/embed/job_app?for=acme"></iframe>')).toBe(true);
    expect(probe('https://acme.com/about/team', '<form><label>Resume/CV <input type="file"></label></form>')).toBe(true);
    // A bare upload (GitHub, a bank, a drive) is not a job page.
    expect(probe('https://acme.com/about/team', '<form><label>Attach a file <input type="file"></label></form>')).toBe(false);
    expect(probe('https://acme.com/thanks', '<h1>Thank you for applying!</h1>')).toBe(true);
  });
});

describe('sites that are never job pages', () => {
  it('watches nothing on mail, chat and docs', () => {
    const doc = new JSDOM('<!doctype html><body>', { url: 'https://mail.google.com/mail/u/0/' }).window.document;
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    startDetector(doc)();
    expect(observe).not.toHaveBeenCalled();
    observe.mockRestore();
  });

  it('still watches LinkedIn\'s feed, which leads to its jobs without a page load', () => {
    const doc = new JSDOM('<!doctype html><body>', { url: 'https://www.linkedin.com/feed/' }).window.document;
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    startDetector(doc)();
    expect(observe).toHaveBeenCalled();
    observe.mockRestore();
  });
});
