import { describe, expect, it, vi } from 'vitest';
import { bodyTextOf, installSubmitWatcher, matchSubmitRequest, replyRefuses } from './submitRequest';

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

  it('an Ashby GraphQL submit refused with HTTP 200 and errors is no submit', async () => {
    const events: unknown[] = [];
    const doc = document.implementation.createHTMLDocument('test');
    doc.addEventListener('wera:submit-request', (e) => events.push((e as CustomEvent).detail));
    let reply = '{"data":null,"errors":[{"message":"Missing required field"}]}';
    const fakeWin = { document: doc, fetch: vi.fn(async () => new Response(reply, { status: 200, headers: { 'Content-Type': 'application/json' } })) } as unknown as Window;
    installSubmitWatcher(fakeWin);
    const url = 'https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiApplicationSubmit';
    await fakeWin.fetch(url, { method: 'POST', body: '{"operationName":"ApiApplicationSubmit"}' });
    await new Promise((r) => setTimeout(r, 0));
    expect(events).toEqual([]);
    reply = '{"data":{"applicationFormSubmit":{"id":"x"}}}';
    await fakeWin.fetch(url, { method: 'POST', body: '{"operationName":"ApiApplicationSubmit"}' });
    await new Promise((r) => setTimeout(r, 0));
    expect(events).toHaveLength(1);
  });

  it('reads refusals and form bodies', () => {
    expect(replyRefuses('{"success": false}')).toBe(true);
    expect(replyRefuses('{"data": {"submit": {"errors": [{"field": "email"}]}}}')).toBe(true);
    expect(replyRefuses('{"data": {"submit": {"id": 3}}}')).toBe(false);
    expect(replyRefuses('<html>Thanks</html>')).toBe(false);
    const fd = new FormData();
    fd.append('job_application[email]', 'a@b.c');
    fd.append('resume', new Blob(['x']), 'r.pdf');
    expect(bodyTextOf(fd)).toBe('job_application[email]=a@b.c&resume=[file]');
  });

  it('knows the submit endpoints of thirteen more systems, and not their drafts', () => {
    expect(matchSubmitRequest('https://jobs.smartrecruiters.com/oneclick-ui/company/Acme/publication/abc/applications', 'POST')).toBe('SmartRecruiters');
    expect(matchSubmitRequest('https://apply.workable.com/api/v3/accounts/acme/jobs/ABC123/apply', 'POST')).toBe('Workable');
    expect(matchSubmitRequest('https://acme.bamboohr.com/careers/42/apply', 'POST')).toBe('BambooHR');
    expect(matchSubmitRequest('https://acme.applytojob.com/apply/AbC123', 'POST')).toBe('JazzHR');
    expect(matchSubmitRequest('https://acme.teamtailor.com/jobs/123-sre/applications', 'POST')).toBe('Teamtailor');
    expect(matchSubmitRequest('https://acme.breezy.hr/p/abc-sre/apply', 'POST')).toBe('Breezy');
    expect(matchSubmitRequest('https://acme.bamboohr.com/careers/42/apply', 'GET')).toBeNull();
    expect(matchSubmitRequest('https://apply.workable.com/api/v3/accounts/acme/jobs/ABC123/apply/draft', 'POST')).toBeNull();
  });
});
