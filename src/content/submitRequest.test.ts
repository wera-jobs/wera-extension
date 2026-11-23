import { describe, expect, it, vi } from 'vitest';
import { installSubmitWatcher, matchSubmitRequest } from './submitRequest';

describe('matchSubmitRequest', () => {
  it('matches real submit endpoints across supported applicant systems', () => {
    const cases: [string, string, string, string][] = [
      ['https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/Careers/job/Austin/SRE_R1/apply', 'POST', '', 'Workday'],
      ['https://acme.wd1.myworkdaysite.com/en-US/recruiting/acme/Careers/apply/submit', 'POST', '', 'Workday'],
      ['https://job-boards.greenhouse.io/acme/jobs/123456', 'POST', '', 'Greenhouse'],
      ['https://boards.greenhouse.io/embed/job_app?for=acme', 'POST', '', 'Greenhouse'],
      ['https://jobs.lever.co/acme/2f1c3b0e-4b8f-4c55-9a7e-5c0d1e2f3a4b/apply', 'POST', '', 'Lever'],
      ['https://jobs.eu.lever.co/acme/2f1c3b0e-4b8f-4c55-9a7e-5c0d1e2f3a4b/apply', 'POST', '', 'Lever'],
      ['https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiApplicationSubmit', 'POST', '', 'Ashby'],
      ['https://jobs.ashbyhq.com/api/non-user-graphql', 'POST', '{"operationName":"ApiApplicationSubmit"}', 'Ashby'],
      ['https://careers-acme.icims.com/jobs/7968/qa-engineer/candidate', 'POST', '', 'iCIMS'],
      ['https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobApplications', 'POST', '', 'Oracle'],
      ['https://career4.successfactors.com/xi/ui/rcmcommon/pages/applicationSubmit', 'POST', '', 'SuccessFactors'],
      ['https://sjobs.brassring.com/TGnewUI/Search/Ajax/SubmitApplication', 'POST', '', 'BrassRing'],
    ];
    for (const [url, method, body, want] of cases) {
      expect(matchSubmitRequest(url, method, body), url).toBe(want);
    }
  });

  it('rejects GETs, drafts, logins, uploads, analytics, and non-submit calls (100% precision)', () => {
    const rejected: [string, string, string][] = [
      ['https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/Careers/job/Austin/SRE_R1/apply', 'GET', ''],
      ['https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/Careers/job/Austin/SRE_R1/apply/draft', 'POST', ''],
      ['https://job-boards.greenhouse.io/acme/jobs/123456/validate', 'POST', ''],
      ['https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams', 'POST', '{"operationName":"ApiJobBoardWithTeams"}'],
      ['https://careers-acme.icims.com/jobs/7968/qa-engineer/login', 'POST', ''],
      ['https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobApplications/upload', 'POST', ''],
      ['https://career4.successfactors.com/xi/ui/rcmcommon/pages/saveDraft', 'POST', ''],
      ['https://www.google-analytics.com/g/collect', 'POST', ''],
      ['https://shop.example.com/checkout/submit', 'POST', ''],
    ];
    for (const [url, method, body] of rejected) {
      expect(matchSubmitRequest(url, method, body), url).toBeNull();
    }
  });

  it('dispatches wera:submit-request on 2xx fetch submit and ignores 4xx/5xx failures', async () => {
    const events: { url: string; system: string }[] = [];
    const doc = document.implementation.createHTMLDocument('test');
    doc.addEventListener('wera:submit-request', (e) => events.push((e as CustomEvent<{ url: string; system: string }>).detail));
    let status = 422;
    const fakeWin = {
      document: doc,
      fetch: vi.fn(async () => ({ ok: status >= 200 && status < 300, status })),
    } as unknown as Window;

    installSubmitWatcher(fakeWin);
    await fakeWin.fetch('https://jobs.lever.co/acme/2f1c3b0e-4b8f-4c55-9a7e-5c0d1e2f3a4b/apply', { method: 'POST' });
    expect(events).toEqual([]);

    status = 200;
    await fakeWin.fetch('https://jobs.lever.co/acme/2f1c3b0e-4b8f-4c55-9a7e-5c0d1e2f3a4b/apply', { method: 'POST' });
    expect(events).toEqual([{ url: 'https://jobs.lever.co/acme/2f1c3b0e-4b8f-4c55-9a7e-5c0d1e2f3a4b/apply', system: 'Lever' }]);
  });
});
