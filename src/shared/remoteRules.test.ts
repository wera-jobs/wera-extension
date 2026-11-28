import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
import { classify } from '../content/classify';
import { collectFields } from '../content/fields';
import { siteFor } from '../content/sites';
import { cleanRules, setRemoteRules, switchedOff } from './remoteRules';

afterEach(() => setRemoteRules(null));

const at = (url: string, html: string) => new JSDOM(`<!doctype html><body>${html}</body>`, { url }).window.document;

describe('site rules as data (#143)', () => {
  it('keeps only well-formed rules: short patterns, real selectors, false switches', () => {
    const r = cleanRules({
      version: 1, switches: { aiSuggest: false, assist: true },
      aliases: [['^years? in role$', 'years_experience'], ['(', 'email'], ['x'.repeat(300), 'email']],
      sites: [{ name: 'Acme ATS', hosts: 'acmeats\\.com$', fields: [['cand_fn', 'first_name']], next: ['#go'] }, { name: 'Bad', hosts: '[' }],
    })!;
    expect(r.aliases).toEqual([['^years? in role$', 'years_experience']]);
    expect(r.sites!.map((s) => s.name)).toEqual(['Acme ATS']);
    expect(r.switches).toEqual({ aiSuggest: false });
    expect(cleanRules({ version: 2 })).toBeNull();
  });

  it('a site from the rules names its fields, Next button and gate, without a release', () => {
    setRemoteRules(cleanRules({ version: 1, sites: [{ name: 'Acme ATS', hosts: 'acmeats\\.com$', fields: [['cand_fn', 'first_name'], ['cand_ref', null]], next: ['#go'], gate: [['#login', 'Sign in to Acme first.']] }] }));
    const doc = at('https://jobs.acmeats.com/apply', '<form><label for="a">Given</label><input id="a" name="cand_fn"><label for="r">Email</label><input id="r" name="cand_ref"><button id="go" type="button">Weiter</button></form><div id="login"></div>');
    expect(siteFor(doc)?.name).toBe('Acme ATS');
    expect(collectFields(doc).map((f) => classify(f))).toEqual(['first_name', null]);
    expect(siteFor(doc)?.next?.(doc)?.textContent).toBe('Weiter');
    expect(siteFor(doc)?.gate?.(doc)).toBe('Sign in to Acme first.');
  });

  it('a label alias from the rules comes before the built-in reading', () => {
    setRemoteRules(cleanRules({ version: 1, aliases: [['^years in role$', 'years_experience']] }));
    const doc = at('https://example.com/apply', '<form><label for="y">Years in role</label><input id="y"></form>');
    expect(collectFields(doc).map((f) => classify(f))).toEqual(['years_experience']);
  });

  it('a switch turns a feature off everywhere, and never on', () => {
    const rules = cleanRules({ version: 1, switches: { aiSuggest: false, assist: true } });
    expect(switchedOff({ aiSuggest: true, assist: false, debug: false }, rules)).toEqual({ aiSuggest: false, assist: false, debug: false });
  });
});
