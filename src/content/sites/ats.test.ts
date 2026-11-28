import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { collectFields } from '../fields';
import { siteFor } from './index';
import { adp, bamboohr, breezy, icims, jazzhr, oracle, paylocity, personio, smartrecruiters, successfactors, taleo, teamtailor, ukg } from './ats';

function readAt(url: string, html: string) {
  const doc = new JSDOM(`<!doctype html><body>${html}`, { url }).window.document;
  const site = siteFor(doc);
  const fields = Object.fromEntries(collectFields(doc).map((f) => [f.el.getAttribute('name') || f.el.id || f.label, site?.purpose?.(f)]));
  return { doc, site, fields };
}

describe('extra ATS site rules (#142)', () => {
  it('iCIMS: recognizes profile fields, resume upload, Next button, and email gate', () => {
    const { doc, site, fields } = readAt('https://careers-acme.icims.com/jobs/1234/sre/candidate', `
      <form id="enterEmailForm">
        <input name="PersonProfileFields.FirstName"><input name="PersonProfileFields.LastName">
        <input name="PersonProfileFields.Email"><input name="PersonProfileFields.Phone">
        <input id="icims_resume" type="file"><button id="iCIMS_NextButton">Next</button>
      </form>`);
    expect(site).toBe(icims);
    expect(fields).toEqual({
      'PersonProfileFields.FirstName': 'first_name', 'PersonProfileFields.LastName': 'last_name',
      'PersonProfileFields.Email': 'email', 'PersonProfileFields.Phone': 'phone', icims_resume: 'resume',
    });
    expect(site?.next?.(doc)?.id).toBe('iCIMS_NextButton');
    expect(site?.gate?.(doc)).toMatch(/iCIMS asks for your email/);
  });

  it('SmartRecruiters: maps core inputs and Next button', () => {
    const { doc, site, fields } = readAt('https://jobs.smartrecruiters.com/oneclick-ui/company/Acme', `
      <input name="firstName"><input name="lastName"><input name="email"><input name="phoneNumber">
      <input name="linkedin"><input name="resume" type="file"><button data-test="next-button">Next</button>`);
    expect(site).toBe(smartrecruiters);
    expect(fields).toEqual({ firstName: 'first_name', lastName: 'last_name', email: 'email', phoneNumber: 'phone', linkedin: 'linkedin', resume: 'resume' });
    expect(site?.next?.(doc)?.textContent).toBe('Next');
  });

  it('Taleo: maps standard fields and privacy gate', () => {
    const { doc, site, fields } = readAt('https://acme.taleo.net/careersection/jobapply.ftl', `
      <div id="privacyAgreement">Privacy</div>
      <input id="et-ef-content-ftf-FirstName"><input id="et-ef-content-ftf-LastName">
      <input id="et-ef-content-ftf-EmailAddress"><input id="et-ef-content-ftf-ZipCode">
      <button id="et-ef-content-ftf-saveContinueCmdBottom">Save and Continue</button>`);
    expect(site).toBe(taleo);
    expect(fields).toEqual({
      'et-ef-content-ftf-FirstName': 'first_name', 'et-ef-content-ftf-LastName': 'last_name',
      'et-ef-content-ftf-EmailAddress': 'email', 'et-ef-content-ftf-ZipCode': 'postal_code',
    });
    expect(site?.gate?.(doc)).toMatch(/privacy agreement/);
    expect(site?.next?.(doc)?.id).toBe('et-ef-content-ftf-saveContinueCmdBottom');
  });

  it('SuccessFactors: maps contact and upload fields', () => {
    const { site, fields } = readAt('https://career4.successfactors.com/career', `
      <input name="firstName"><input name="lastName"><input name="contactEmail"><input name="cellPhone"><input name="resume" type="file">`);
    expect(site).toBe(successfactors);
    expect(fields).toEqual({ firstName: 'first_name', lastName: 'last_name', contactEmail: 'email', cellPhone: 'phone', resume: 'resume' });
  });

  it('Oracle Cloud HCM: maps fields, active step, Next button, and email verification gate', () => {
    const { doc, site, fields } = readAt('https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/1/apply', `
      <div class="apply-flow-email-verification">Verify</div>
      <div class="apply-flow-progress__step">1</div><div class="apply-flow-progress__step apply-flow-progress__step--active">Personal Info</div>
      <input data-qa="first-name" id="fn"><input data-qa="last-name" id="ln"><input data-qa="postal-code" id="pc">
      <button data-qa="nextButton">Next</button>`);
    expect(site).toBe(oracle);
    expect(fields).toEqual({ fn: 'first_name', ln: 'last_name', pc: 'postal_code' });
    expect(site?.step?.(doc)).toEqual({ name: 'Personal Info', index: 2, total: 2 });
    expect(site?.next?.(doc)?.textContent).toBe('Next');
    expect(site?.gate?.(doc)).toMatch(/verify your email/);
  });

  it('BambooHR, Paylocity, ADP, and UKG: match host and map fields', () => {
    expect(readAt('https://acme.bamboohr.com/careers/42', '<input name="firstName"><input name="desiredSalary"><input name="dateAvailable">').site).toBe(bamboohr);
    expect(readAt('https://acme.bamboohr.com/careers/42', '<input name="firstName"><input name="desiredSalary"><input name="dateAvailable">').fields)
      .toEqual({ firstName: 'first_name', desiredSalary: 'salary_expectation', dateAvailable: 'start_date' });

    const pay = readAt('https://recruiting.paylocity.com/Recruiting/Jobs/Apply/12', '<input name="info.firstName"><input name="info.cellPhone"><button id="btnNext">Next</button>');
    expect(pay.site).toBe(paylocity);
    expect(pay.fields).toEqual({ 'info.firstName': 'first_name', 'info.cellPhone': 'phone' });
    expect(pay.site?.next?.(pay.doc)?.id).toBe('btnNext');

    const a = readAt('https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html', '<input name="firstName"><input name="stateProvince"><input name="postalCode">');
    expect(a.site).toBe(adp);
    expect(a.fields).toEqual({ firstName: 'first_name', stateProvince: 'state', postalCode: 'postal_code' });

    const u = readAt('https://recruiting.ultipro.com/ACM/JobBoard/1/OpportunityDetail', '<input name="FirstName"><input name="PrimaryPhone"><button data-automation="next-button">Next</button>');
    expect(u.site).toBe(ukg);
    expect(u.fields).toEqual({ FirstName: 'first_name', PrimaryPhone: 'phone' });
    expect(u.site?.next?.(u.doc)?.textContent).toBe('Next');
  });

  it('Teamtailor, Personio, JazzHR, and Breezy: match host and map fields', () => {
    const tt = readAt('https://acme.teamtailor.com/jobs/123', '<input name="candidate[first_name]"><input name="candidate[resume]" type="file"><textarea name="candidate[pitch]"></textarea>');
    expect(tt.site).toBe(teamtailor);
    expect(tt.fields).toEqual({ 'candidate[first_name]': 'first_name', 'candidate[resume]': 'resume', 'candidate[pitch]': 'cover_letter' });

    const pe = readAt('https://acme.jobs.personio.de/job/123', '<input name="first_name"><input name="available_from"><input name="salary_expectations"><input name="document" type="file">');
    expect(pe.site).toBe(personio);
    expect(pe.fields).toEqual({ first_name: 'first_name', available_from: 'start_date', salary_expectations: 'salary_expectation', document: 'resume' });

    const jz = readAt('https://acme.applytojob.com/apply/abc', '<input id="resumator-firstname-value"><input id="resumator-lastname-value"><input id="resumator-college-value"><input id="resumator-resume-value" type="file">');
    expect(jz.site).toBe(jazzhr);
    expect(jz.fields).toEqual({
      'resumator-firstname-value': 'first_name', 'resumator-lastname-value': 'last_name',
      'resumator-college-value': 'school', 'resumator-resume-value': 'resume',
    });

    const br = readAt('https://acme.breezy.hr/p/abc/apply', '<input name="name"><input name="email_address"><input name="phone_number"><input name="resume" type="file">');
    expect(br.site).toBe(breezy);
    expect(br.fields).toEqual({ name: 'full_name', email_address: 'email', phone_number: 'phone', resume: 'resume' });
  });
});

describe('ten more systems (#239)', () => {
  it('knows each by its host or markup, and says when a form wants a sign-in first', () => {
    const at = (url: string, html = '') => siteFor(new JSDOM(`<!doctype html><body>${html}`, { url }).window.document)?.name ?? null;
    expect(at('https://miaplaza.recruitee.com/o/sre/c/new')).toBe('Recruitee');
    expect(at('https://acme.pinpointhq.com/en/postings/1/applications/new')).toBe('Pinpoint');
    expect(at('https://jobs.dover.com/acme/1')).toBe('Dover');
    expect(at('https://jobs.gem.com/acme/1')).toBe('Gem');
    expect(at('https://jobs.dayforcehcm.com/en-US/acme/candidateportal/jobs/1/apply')).toBe('Dayforce');
    expect(at('https://www.paycomonline.net/v4/ats/web.php/jobs/ViewJobDetails')).toBe('Paycom');
    expect(at('https://sjobs.brassring.com/TGnewUI/Search/Home')).toBe('BrassRing');
    expect(at('https://careers.acme.com/careers', '<div id="pcs-body-container"></div>')).toBe('Eightfold');
    expect(at('https://careers.acme.com/job/1', '<div data-ph-at-id="apply-link"></div>')).toBe('Phenom');
    expect(at('https://acme.avature.net/careers')).toBe('Avature');
    expect(at('https://example.com/about')).toBeNull();
    const doc = new JSDOM('<!doctype html><body><p>Sign in to apply for this job, or create an account to continue.</p><input type="email"></body>', { url: 'https://jobs.dayforcehcm.com/en-US/acme/candidateportal/jobs/1/apply' }).window.document;
    expect(siteFor(doc)?.gate?.(doc)).toMatch(/Sign in or create an account/);
  });
});
