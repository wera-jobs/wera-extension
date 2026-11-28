import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { classify } from './classify';
import { collectFields } from './fields';

const purposes = (html: string, host = 'acme.icims.com') => {
  const doc = new JSDOM(`<!doctype html><body>${html}`, { url: `https://${host}/jobs/1/apply` }).window.document;
  return collectFields(doc).map((f) => [f.label, classify(f)]);
};

describe('details inside a job, school or reference block are that block\'s', () => {
  it('a site rule\'s "phone" or "email" in a reference block is not the applicant\'s', () => {
    const got = purposes(`<form>
      <label for="p">Phone</label><input id="p" name="phone">
      <section id="references"><h3>References</h3>
        <label for="rn">Name</label><input id="rn" name="ref_name">
        <label for="rp">Phone</label><input id="rp" name="ref_phone">
        <label for="re">Email</label><input id="re" name="ref_email" type="email"></section></form>`);
    expect(got).toEqual([['Phone', 'phone'], ['Name', null], ['Phone', null], ['Email', null]]);
  });

  it('an employer\'s city and a supervisor\'s phone in a job block are not the applicant\'s', () => {
    const got = purposes(`<form><div id="workExperience-1"><h3>Work Experience</h3>
      <label for="t">Job Title</label><input id="t" name="title">
      <label for="c">City</label><input id="c" name="city">
      <label for="s">Supervisor Phone</label><input id="s" name="phone"></div></form>`);
    expect(got).toEqual([['Job Title', 'exp_title'], ['City', 'exp_location'], ['Supervisor Phone', null]]);
  });

  it('a transcript upload named "document" is no resume (Personio)', () => {
    const got = purposes(`<form><label for="r">CV</label><input id="r" type="file" name="documents[cv]">
      <label for="t">Transcript</label><input id="t" type="file" name="document"></form>`, 'acme.jobs.personio.de');
    expect(got.map((g) => g[1])).toEqual(['resume', null]);
  });
});
