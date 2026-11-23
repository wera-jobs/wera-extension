import { describe, expect, it } from 'vitest';
import { accountWall, consentWall } from './gate';

const show = (html: string) => {
  document.body.innerHTML = html;
  return accountWall(document);
};

const showConsent = (html: string) => {
  document.body.innerHTML = html;
  return consentWall(document);
};

describe('a page that wants an account first', () => {
  it('sign in and create account, with nothing to fill (Dayforce)', () => {
    expect(show(`<h2>Already Have an Account?</h2><button>Sign In</button><p>Don't have an account? <a href="#">Create one</a></p>`)).toMatch(/account first/);
  });

  it('a password box with little else', () => {
    expect(show('<label for="e">Email</label><input id="e" type="email"><label for="p">Password</label><input id="p" type="password"><button>Continue</button>')).toMatch(/account first/);
  });

  it('not an application with sign-in links in its header', () => {
    expect(show(`<a href="#">Sign in</a><a href="#">Create account</a>
      <label for="a">First name</label><input id="a"><label for="b">Last name</label><input id="b">
      <label for="c">Email</label><input id="c"><label for="d">Phone</label><input id="d">`)).toBeNull();
  });

  it('not a page with no way in', () => {
    expect(show('<h1>Software Engineer</h1><p>Join us.</p><a href="#">Apply</a>')).toBeNull();
  });

  it('not one link alone: every site has a sign-in link', () => {
    expect(show('<a href="#">Sign in</a><p>Open roles</p>')).toBeNull();
  });
});

describe('a pre-form consent or location/language step', () => {
  it('recognizes a data-consent page with country and language pickers', () => {
    expect(showConsent(`
      <h2>Data Consent</h2>
      <label for="c">Country</label><select id="c"><option>United States</option></select>
      <label for="l">Preferred Language</label><select id="l"><option>English</option></select>
      <label><input type="checkbox"> I consent to the processing of my personal data</label>
      <button>Accept and Continue</button>
    `)).toMatch(/location, language and data consent/);
  });

  it('recognizes a consent-only privacy step', () => {
    expect(showConsent(`
      <h2>Candidate Privacy Notice</h2>
      <p>Please review our data protection terms before applying.</p>
      <label><input type="checkbox"> I agree to the privacy notice</label>
      <button>Accept</button>
    `)).toMatch(/data consent or terms/);
  });

  it('recognizes a location and language pre-step without consent', () => {
    expect(showConsent(`
      <h2>Select your location</h2>
      <label for="c">Country</label><select id="c"><option>United States</option></select>
      <label for="l">Language</label><select id="l"><option>English</option></select>
      <button>Continue</button>
    `)).toMatch(/location or language/);
  });

  it('does not flag a full application form that happens to include a consent box', () => {
    expect(showConsent(`
      <h2>Application</h2>
      <label for="a">First Name</label><input id="a">
      <label for="b">Last Name</label><input id="b">
      <label for="c">Email</label><input id="c" type="email">
      <label><input type="checkbox"> I agree to the privacy policy</label>
      <button>Submit</button>
    `)).toBeNull();
  });
});
