import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
import type { Applicant } from '../shared/types';
import { autofill } from '../test/autofill';
import { findNext } from './next';
import { planForm } from './plan';
import { siteFor } from './sites';

const ada: Applicant = {
  first_name: 'Ada', last_name: 'Lovelace', preferred_name: '', email: 'ada@example.com', phone: '512-555-0142',
  address: '100 Main St', city: 'Austin', state: 'TX', postal_code: '78701', country: 'United States',
  linkedin: 'https://linkedin.com/in/ada', github: 'https://github.com/ada', portfolio: 'https://ada.dev',
  current_company: 'Acme', current_title: 'SRE', years_experience: '4', school: 'UT Austin', degree: 'Bachelor of Science',
  major: 'Computer Science', graduation_year: '2024', gpa: '3.9', authorized_to_work: 'yes', needs_sponsorship: 'no',
  willing_to_relocate: 'yes', salary_expectation: '', start_date: '', how_heard: 'Company website',
  gender: 'decline', pronouns: '', race: 'decline', hispanic: 'decline', veteran: 'decline', disability: 'decline',
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('widget test lab: Stripe / Duolingo custom controls', () => {
  it('opens and commits an embedded React-Select v5 portal menu (Stripe/Greenhouse style)', async () => {
    document.body.innerHTML = `
      <form>
        <div class="field">
          <label for="country-input">Country</label>
          <div class="select__control" id="country-ctrl">
            <div class="select__value-container">
              <input id="country-input" role="combobox" aria-autocomplete="list" value="">
            </div>
          </div>
        </div>
      </form>`;
    const ctrl = document.getElementById('country-ctrl')!;
    const input = document.getElementById('country-input') as HTMLInputElement;
    // React-Select v5 in embedded frames opens its portal menu on mousedown on the control wrapper.
    ctrl.addEventListener('mousedown', () => {
      if (document.querySelector('.select__menu')) return;
      const menu = document.createElement('div');
      menu.className = 'select__menu';
      menu.innerHTML = `
        <div id="react-select-2-option-0" class="select__option">Canada</div>
        <div id="react-select-2-option-1" class="select__option">United States</div>`;
      menu.querySelectorAll('.select__option').forEach((opt) => {
        opt.addEventListener('pointerdown', () => {
          const val = document.createElement('div');
          val.className = 'select__single-value';
          val.textContent = opt.textContent;
          ctrl.querySelector('.select__value-container')!.prepend(val);
          input.value = '';
          menu.remove();
        });
      });
      document.body.appendChild(menu);
    });

    const out = await autofill(document, ada, {});
    expect(out.find((r) => r.label === 'Country')).toMatchObject({ status: 'filled', value: 'United States' });
    expect(ctrl.querySelector('.select__single-value')?.textContent).toBe('United States');
  });

  it('keeps values in controlled React inputs that clear on synchronous blur (Duolingo style)', async () => {
    document.body.innerHTML = `<form><label for="em">Email</label><input id="em" type="email"></form>`;
    const em = document.getElementById('em') as HTMLInputElement;
    let committed = '';
    em.addEventListener('input', () => {
      const next = em.value;
      // Simulate React committing controlled state asynchronously on a timer/microtask.
      setTimeout(() => { committed = next; }, 15);
    });
    em.addEventListener('blur', () => {
      // If blur runs before state commits, the controlled input resets to stale state.
      em.value = committed;
    });

    const out = await autofill(document, ada, {});
    expect(out.find((r) => r.label === 'Email')).toMatchObject({ status: 'filled', value: 'ada@example.com' });
    expect(em.value).toBe('ada@example.com');
  });
});

describe('site adapters: LinkedIn Easy Apply and Indeed Apply', () => {
  it('recognizes LinkedIn Easy Apply modal fields, progress step, and Next button', () => {
    const doc = new JSDOM(`
      <div class="jobs-easy-apply-modal" role="dialog" aria-modal="true">
        <h3>Contact info</h3>
        <progress value="50" max="100"></progress>
        <label for="urn-phoneNumber-nationalNumber">Mobile phone number</label>
        <input id="urn-phoneNumber-nationalNumber" type="tel">
        <label for="urn-emailAddress">Email address</label>
        <input id="urn-emailAddress" type="email">
        <button type="button" aria-label="Continue to next step">Next</button>
      </div>`, { url: 'https://www.linkedin.com/jobs/view/123' }).window.document;
    expect(siteFor(doc)?.name).toBe('LinkedIn');
    const plan = planForm(doc.body, ada);
    expect(plan.step).toEqual({ name: 'Contact info', index: 2, total: 4 });
    expect(plan.fields.find((f) => f.purpose === 'phone')?.value).toBe('512-555-0142');
    expect(plan.fields.find((f) => f.purpose === 'email')?.value).toBe('ada@example.com');
    expect(findNext(doc.body)).toMatchObject({ label: 'Continue to next step', final: false });
  });

  it('recognizes Indeed SmartApply fields, progress step, and Continue button', () => {
    document.body.innerHTML = `
      <div class="ia-BasePage">
        <h1 class="ia-BasePage-heading">Add your contact information</h1>
        <div role="progressbar" aria-valuenow="25" aria-valuemax="100"></div>
        <label for="input-first-name">First name</label><input id="input-first-name">
        <label for="input-last-name">Last name</label><input id="input-last-name">
        <label for="input-phone-number">Phone number</label><input id="input-phone-number">
        <button type="button" data-testid="continue-button">Continue</button>
      </div>`;
    expect(siteFor(document)?.name).toBe('Indeed');
    const plan = planForm(document, ada);
    expect(plan.step).toEqual({ name: 'Add your contact information', index: 1, total: 4 });
    expect(plan.fields.find((f) => f.purpose === 'first_name')?.value).toBe('Ada');
    expect(plan.fields.find((f) => f.purpose === 'last_name')?.value).toBe('Lovelace');
    expect(plan.fields.find((f) => f.purpose === 'phone')?.value).toBe('512-555-0142');
    expect(findNext(document)).toMatchObject({ label: 'Continue', final: false });
  });
});
