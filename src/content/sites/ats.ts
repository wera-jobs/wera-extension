// Site rules for 13 major applicant tracking systems (alongside Workday,
// Greenhouse, Lever, Ashby, Jobvite, Workable, LinkedIn, and Indeed):
// iCIMS, SmartRecruiters, Taleo, SuccessFactors, Oracle Cloud HCM,
// BambooHR, Paylocity, ADP, UKG/UltiPro, Teamtailor, Personio, JazzHR,
// and Breezy. Each maps the system's own field names/ids, Next button,
// and pre-form gates where they differ from generic reading.
import type { FieldPurpose } from '../../shared/types';
import type { Field } from '../fields';
import type { Site, Step } from './index';

type Rule = [RegExp, FieldPurpose | null];

function fieldKey(f: Field): string {
  const parts = [
    f.el.getAttribute('name') ?? '',
    f.el.id ?? '',
    f.el.getAttribute('data-test') ?? '',
    f.el.getAttribute('data-testid') ?? '',
    f.el.getAttribute('data-qa') ?? '',
    f.el.getAttribute('data-automation') ?? '',
    f.el.getAttribute('data-uxi-element-id') ?? '',
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function matchRules(rules: Rule[]): (f: Field) => FieldPurpose | null | undefined {
  return (f) => {
    const key = fieldKey(f);
    if (!key) return undefined;
    for (const [re, purpose] of rules) if (re.test(key)) return purpose;
    return undefined;
  };
}

function firstVisible(doc: Document, selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    const el = doc.querySelector<HTMLElement>(sel);
    if (el && !(el as HTMLButtonElement).disabled) return el;
  }
  return null;
}

function stepFrom(doc: Document, activeSel: string, allSel: string): Step | null {
  const active = doc.querySelector(activeSel);
  if (!active) return null;
  const all = [...doc.querySelectorAll(allSel)];
  const steps = all.length ? all : [active];
  return {
    name: (active.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
    index: Math.max(0, steps.indexOf(active)) + 1,
    total: steps.length,
  };
}

export const icims: Site = {
  name: 'iCIMS',
  matches: (doc) => /(^|\.)icims\.com$/i.test(doc.location?.hostname ?? ''),
  purpose: matchRules([
    [/personprofilefields\.firstname|rcf3048|first[_-]?name/, 'first_name'],
    [/personprofilefields\.middlename|middle[_-]?name/, 'middle_name'],
    [/personprofilefields\.lastname|rcf3049|last[_-]?name/, 'last_name'],
    [/personprofilefields\.email|email/, 'email'],
    [/personprofilefields\.phone|mobilephone|homephone|phone/, 'phone'],
    [/personprofilefields\.addressstreet1|address1|street/, 'address'],
    [/personprofilefields\.addressstreet2|address2/, 'address_line2'],
    [/personprofilefields\.addresscity|city/, 'city'],
    [/personprofilefields\.addressstate|state/, 'state'],
    [/personprofilefields\.addresszip|postal|zip/, 'postal_code'],
    [/personprofilefields\.addresscountry|country/, 'country'],
    [/icims_resume|resume|cv_upload/, 'resume'],
    [/coverletter|cover_letter/, 'cover_letter'],
    [/linkedin/, 'linkedin'],
  ]),
  next: (doc) => firstVisible(doc, ['#iCIMS_NextButton', '#enterEmailSubmitButton', 'input[type="submit"][id*="Next"]']),
  step: (doc) => stepFrom(doc, '.iCIMS_StepIndicator .iCIMS_Active, .iCIMS_ProgressBar .active', '.iCIMS_StepIndicator li, .iCIMS_ProgressBar li'),
  gate: (doc) => {
    if (doc.querySelector('#enterEmailForm') || /\/login\b/i.test(doc.location?.pathname ?? '')) {
      return 'iCIMS asks for your email (or sign-in) before the application. Press Autofill to fill your email, then continue to the form.';
    }
    return null;
  },
  pace: 60,
};

export const smartrecruiters: Site = {
  name: 'SmartRecruiters',
  matches: (doc) => /^jobs\.smartrecruiters\.com$/i.test(doc.location?.hostname ?? ''),
  purpose: matchRules([
    [/\bfirstname\b|first-name/, 'first_name'],
    [/\blastname\b|last-name/, 'last_name'],
    [/\bemail\b/, 'email'],
    [/phonenumber|phone-number|\bphone\b/, 'phone'],
    [/\blocation\b|\bcity\b/, 'location'],
    [/linkedin/, 'linkedin'],
    [/website|portfolio/, 'portfolio'],
    [/resume|cv/, 'resume'],
    [/coverletter|cover-letter|message-to-hiring/, 'cover_letter'],
  ]),
  next: (doc) => firstVisible(doc, ['[data-test="next-button"]', 'button.oc-button-next']),
  pace: 80,
};

export const taleo: Site = {
  name: 'Taleo',
  matches: (doc) => /(^|\.)taleo\.net$/i.test(doc.location?.hostname ?? ''),
  purpose: matchRules([
    [/firstname|first_name/, 'first_name'],
    [/middlename|middle_name/, 'middle_name'],
    [/lastname|last_name/, 'last_name'],
    [/emailaddress|\bemail\b/, 'email'],
    [/mobilephone|homephone|cellphone|phone/, 'phone'],
    [/address2|addressline2/, 'address_line2'],
    [/address1|addressline1|\baddress\b/, 'address'],
    [/\bcity\b/, 'city'],
    [/\bstate\b|province/, 'state'],
    [/zipcode|postalcode|\bzip\b/, 'postal_code'],
    [/\bcountry\b/, 'country'],
    [/resumeupload|resume/, 'resume'],
    [/coverletter/, 'cover_letter'],
  ]),
  next: (doc) => firstVisible(doc, ['[id*="saveContinue"]', '[id*="nextButton"]', 'input[id*="Next"]']),
  gate: (doc) => {
    if (doc.querySelector('#privacyAgreement, [id*="privacyAgreement"]')) {
      return 'Taleo asks you to accept its privacy agreement before the application. Review and accept it here, then continue to the form.';
    }
    return null;
  },
  pace: 80,
};

export const successfactors: Site = {
  name: 'SuccessFactors',
  matches: (doc) => /(^|\.)(successfactors|sapsf)\.(com|eu)$/i.test(doc.location?.hostname ?? ''),
  purpose: matchRules([
    [/firstname|first_name/, 'first_name'],
    [/middlename|middle_name/, 'middle_name'],
    [/lastname|last_name/, 'last_name'],
    [/contactemail|emailaddress|\bemail\b/, 'email'],
    [/cellphone|homephone|phone/, 'phone'],
    [/address2|addressline2/, 'address_line2'],
    [/address1|addressline1|\baddress\b/, 'address'],
    [/\bcity\b/, 'city'],
    [/\bstate\b|province/, 'state'],
    [/\bzip\b|postal/, 'postal_code'],
    [/\bcountry\b/, 'country'],
    [/resume/, 'resume'],
    [/coverletter/, 'cover_letter'],
  ]),
  next: (doc) => firstVisible(doc, ['[data-testid="next"]', 'button[id*="nextBtn"]', 'button[id*="continue"]']),
  pace: 80,
};

export const oracle: Site = {
  name: 'Oracle',
  matches: (doc) => /(^|\.)oraclecloud\.com$/i.test(doc.location?.hostname ?? '') || /\/hcmui\/candidateexperience\//i.test(doc.location?.pathname ?? ''),
  purpose: matchRules([
    [/first[-_]?name/, 'first_name'],
    [/middle[-_]?name/, 'middle_name'],
    [/last[-_]?name/, 'last_name'],
    [/email[-_]?address|\bemail\b/, 'email'],
    [/phone[-_]?number|\bphone\b/, 'phone'],
    [/address[-_]?line[-_]?2/, 'address_line2'],
    [/address[-_]?line[-_]?1|\baddress\b/, 'address'],
    [/\bcity\b/, 'city'],
    [/\bstate\b|province|region/, 'state'],
    [/postal[-_]?code|zip[-_]?code/, 'postal_code'],
    [/\bcountry\b/, 'country'],
    [/resume|cv/, 'resume'],
    [/cover[-_]?letter/, 'cover_letter'],
    [/linkedin/, 'linkedin'],
  ]),
  next: (doc) => firstVisible(doc, ['button[data-qa="nextButton"]', '.apply-flow-navigation__next', 'button.apply-flow-pagination__next-button']),
  step: (doc) => stepFrom(doc, '.apply-flow-progress__step--active', '.apply-flow-progress__step'),
  gate: (doc) => {
    if (doc.querySelector('.apply-flow-email-verification, [data-qa="emailVerification"]')) {
      return 'Oracle asks to verify your email before the application. Enter the code sent to your inbox, and Wera fills the application on the next page.';
    }
    return null;
  },
  pace: 100,
};

export const bamboohr: Site = {
  name: 'BambooHR',
  matches: (doc) => /(^|\.)bamboohr\.com$/i.test(doc.location?.hostname ?? ''),
  purpose: matchRules([
    [/firstname|first_name/, 'first_name'],
    [/lastname|last_name/, 'last_name'],
    [/\bemail\b/, 'email'],
    [/\bphone\b/, 'phone'],
    [/\baddress\b|street/, 'address'],
    [/\bcity\b/, 'city'],
    [/\bstate\b/, 'state'],
    [/\bzip\b|postal/, 'postal_code'],
    [/\bcountry\b/, 'country'],
    [/linkedin/, 'linkedin'],
    [/website|portfolio/, 'portfolio'],
    [/desiredsalary|salary/, 'salary_expectation'],
    [/dateavailable|startdate/, 'start_date'],
    [/resume/, 'resume'],
    [/coverletter/, 'cover_letter'],
  ]),
};

export const paylocity: Site = {
  name: 'Paylocity',
  matches: (doc) => /^recruiting\.paylocity\.com$/i.test(doc.location?.hostname ?? ''),
  purpose: matchRules([
    [/firstname|first_name/, 'first_name'],
    [/middlename|middle_name/, 'middle_name'],
    [/lastname|last_name/, 'last_name'],
    [/\bemail\b/, 'email'],
    [/cellphone|homephone|phone/, 'phone'],
    [/address2/, 'address_line2'],
    [/address1|\baddress\b/, 'address'],
    [/\bcity\b/, 'city'],
    [/\bstate\b/, 'state'],
    [/\bzip\b|postal/, 'postal_code'],
    [/\bcountry\b/, 'country'],
    [/resume/, 'resume'],
    [/coverletter/, 'cover_letter'],
  ]),
  next: (doc) => firstVisible(doc, ['#btnNext', 'button.next-step', '[data-testid="next-step"]']),
  pace: 60,
};

export const adp: Site = {
  name: 'ADP',
  matches: (doc) => /^(workforcenow|recruiting|myjobs)\.adp\.com$/i.test(doc.location?.hostname ?? ''),
  purpose: matchRules([
    [/firstname|first_name/, 'first_name'],
    [/middlename|middle_name/, 'middle_name'],
    [/lastname|last_name/, 'last_name'],
    [/emailaddress|\bemail\b/, 'email'],
    [/phonenumber|\bphone\b/, 'phone'],
    [/addressline2/, 'address_line2'],
    [/addressline1|\baddress\b/, 'address'],
    [/\bcity\b/, 'city'],
    [/stateprovince|\bstate\b/, 'state'],
    [/postalcode|\bzip\b/, 'postal_code'],
    [/countrycode|\bcountry\b/, 'country'],
    [/resume/, 'resume'],
    [/coverletter/, 'cover_letter'],
  ]),
  next: (doc) => firstVisible(doc, ['[data-testid="next-button"]', 'button[id*="next"]']),
  pace: 80,
};

export const ukg: Site = {
  name: 'UKG',
  matches: (doc) => /(^|\.)(ultipro\.(com|ca)|ukg\.net)$/i.test(doc.location?.hostname ?? ''),
  purpose: matchRules([
    [/firstname|first_name/, 'first_name'],
    [/middlename|middle_name/, 'middle_name'],
    [/lastname|last_name/, 'last_name'],
    [/emailaddress|\bemail\b/, 'email'],
    [/primaryphone|mobilephone|phone/, 'phone'],
    [/addressline2/, 'address_line2'],
    [/addressline1|\baddress\b/, 'address'],
    [/\bcity\b/, 'city'],
    [/\bstate\b|province/, 'state'],
    [/postalcode|\bzip\b/, 'postal_code'],
    [/\bcountry\b/, 'country'],
    [/resume/, 'resume'],
    [/coverletter/, 'cover_letter'],
  ]),
  next: (doc) => firstVisible(doc, ['[data-automation="next-button"]', 'button[data-uxi-element-id*="Next"]']),
  pace: 80,
};

export const teamtailor: Site = {
  name: 'Teamtailor',
  matches: (doc) => /(^|\.)teamtailor\.com$/i.test(doc.location?.hostname ?? ''),
  purpose: matchRules([
    [/candidate\[first_name\]|first_name/, 'first_name'],
    [/candidate\[last_name\]|last_name/, 'last_name'],
    [/candidate\[email\]|\bemail\b/, 'email'],
    [/candidate\[phone\]|\bphone\b/, 'phone'],
    [/candidate\[resume\]|resume/, 'resume'],
    [/candidate\[cover_letter\]|cover_letter|candidate\[pitch\]/, 'cover_letter'],
    [/linkedin/, 'linkedin'],
    [/website|portfolio/, 'portfolio'],
  ]),
};

export const personio: Site = {
  name: 'Personio',
  matches: (doc) => /(^|\.)jobs\.personio\.(de|com)$/i.test(doc.location?.hostname ?? ''),
  purpose: matchRules([
    [/first_name/, 'first_name'],
    [/last_name/, 'last_name'],
    [/\bemail\b/, 'email'],
    [/\bphone\b/, 'phone'],
    [/available_from/, 'start_date'],
    [/salary_expectations/, 'salary_expectation'],
    [/cover_letter|anschreiben/, 'cover_letter'],
    [/\bdocument\b|resume|\bcv\b/, 'resume'],
    [/\bgender\b/, 'gender'],
    [/\blocation\b/, 'location'],
  ]),
};

export const jazzhr: Site = {
  name: 'JazzHR',
  matches: (doc) => /(^|\.)(applytojob|jazzhr)\.com$/i.test(doc.location?.hostname ?? ''),
  purpose: matchRules([
    [/resumator-firstname/, 'first_name'],
    [/resumator-lastname/, 'last_name'],
    [/resumator-email/, 'email'],
    [/resumator-phone/, 'phone'],
    [/resumator-address/, 'address'],
    [/resumator-city/, 'city'],
    [/resumator-state/, 'state'],
    [/resumator-postal/, 'postal_code'],
    [/resumator-resume/, 'resume'],
    [/resumator-coverletter/, 'cover_letter'],
    [/resumator-linkedin/, 'linkedin'],
    [/resumator-website/, 'portfolio'],
    [/resumator-salary/, 'salary_expectation'],
    [/resumator-college/, 'school'],
  ]),
};

export const breezy: Site = {
  name: 'Breezy',
  matches: (doc) => /(^|\.)breezy\.hr$/i.test(doc.location?.hostname ?? ''),
  purpose: matchRules([
    [/^name$|full_name/, 'full_name'],
    [/email_address|\bemail\b/, 'email'],
    [/phone_number|\bphone\b/, 'phone'],
    [/\baddress\b/, 'address'],
    [/resume/, 'resume'],
    [/cover_letter|summary/, 'cover_letter'],
    [/linkedin/, 'linkedin'],
    [/website|portfolio/, 'portfolio'],
  ]),
};

export const EXTRA_SITES: Site[] = [
  icims,
  smartrecruiters,
  taleo,
  successfactors,
  oracle,
  bamboohr,
  paylocity,
  adp,
  ukg,
  teamtailor,
  personio,
  jazzhr,
  breezy,
];
