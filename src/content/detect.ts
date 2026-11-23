// Tells a job page from any other page by positive evidence, never by a
// page merely sounding like one: the address of a job on a system or board
// Wera knows, the page's schema.org JobPosting, an application embedded
// from its applicant tracking system, a form only an application would be,
// or a page on a careers address that reads like a posting and has a way
// to apply. Shopping, mail, banks and the rest have none of these, so Wera
// never shows there (the toolbar icon still opens it anywhere). Reads the
// page only; sends nothing anywhere.
import type { FieldPurpose } from '../shared/types';
import { classify } from './classify';
import { ENTRY_PURPOSES } from './entries';
import { collectFields } from './fields';
import { gateOf } from './gate';
import { outOfSight } from './hidden';
import { isApplicantHost } from './frames';
import { readJobPosting } from './jsonld';
import { siteFor } from './sites';
import { applyAddress, careerAddress, EMBEDDED_FORM, insideNotJobSite, isJobUrl, isNotJobSite } from './urls';

export { careerAddress, isJobUrl, isNotJobSite };
export type PageKind = 'form' | 'posting' | null;

/** Whether the address is a step of an application on an applicant system (which may also be called its login). */
function applyStep(url: string): boolean {
  return applyAddress(url) || /[?&]mode=(apply|login)\b/i.test(url) || /\.icims\.com\/jobs\/\d+\/[^?]*\/login\b/i.test(url);
}

const APPLY = /^\s*(apply|apply now|apply (for|to) (this|the) (job|position|role|opening|vacancy)|apply (online|here|today)|easy apply|quick apply|apply on (the )?(company|employer)('s)? (site|website)|(start|begin) (your |my )?application|submit (your |my )?application|i'?m interested|(jetzt |hier |online )?bewerben|(auf diese stelle|für diese stelle) bewerben|postuler( maintenant| à cette offre)?|candidatez|solicitar( empleo| ahora)?|aplicar( ahora)?|postular(me|se)?|candidatar(-se)?|candidati( ora)?|solliciteer( nu)?|solliciteren)\s*[→›>]?\s*$/i;
const SECTIONS = [
  /responsibilit/i, /qualification/i, /requirement/i, /what you('|’)?ll do/i, /about the (role|job|position|team)/i,
  /about you/i, /benefits/i, /job description/i, /years of (professional |relevant )?experience/i,
  /equal (employment )?opportunity/i, /who you are/i, /what we('|’)?re looking for/i, /compensation|salary range|pay range/i,
];
// A job's address that no longer has the job.
const GONE = /\b(page|job|position|posting|role) (was )?not found\b|^(404|not found)\b|no longer (available|accepting|open)\b|job (has )?(expired|closed)\b/i;

/** The page's job title as people see it: the main heading. */
function headline(doc: Document): string {
  const h1 = [...doc.querySelectorAll('h1')].map((h) => (h.textContent ?? '').trim()).find((t) => t.length >= 3 && t.length <= 140);
  return h1 ?? '';
}

/** What a button says. Some say it twice, once for screen readers ("ApplyApply"). */
function buttonText(b: Element): string {
  const text = (b.tagName === 'INPUT' ? (b as HTMLInputElement).value : (b.textContent ?? '')).trim();
  const half = text.slice(0, text.length / 2);
  return half && text === half + half ? half : text;
}

/** Whether the page has a way to apply: on a careers address a bare "Apply" means that; on a shop it applies a coupon. */
function hasApplyButton(doc: Document): boolean {
  const buttons = doc.querySelectorAll('a, button, input[type="submit"], [role="button"]');
  return [...buttons].slice(0, 600).some((b) => {
    const text = buttonText(b);
    return text.length < 60 && APPLY.test(text);
  });
}

/** The page's way to apply, when it shows one (on a job page: on a shop this would be a coupon's button). */
export function findApply(doc: Document): HTMLElement | null {
  const buttons = [...doc.querySelectorAll<HTMLElement>('a, button, input[type="submit"], [role="button"]')].slice(0, 600);
  const says = (re: RegExp) => buttons.find((b) => {
    const text = buttonText(b);
    return text.length < 60 && re.test(text) && !outOfSight(b);
  });
  // Ashby has an Application tab beside the posting.
  return says(APPLY) ?? says(/^\s*application\s*$/i) ?? null;
}

/** How many of a posting's usual sections the page's text has. */
function sectionCount(doc: Document): number {
  const text = (doc.body?.innerText || doc.body?.textContent || '').slice(0, 40000);
  return SECTIONS.filter((re) => re.test(text)).length;
}

/** Whether a page with no job data reads like one job's posting: a careers address, a title, sections and a way to apply. */
function readsLikePosting(doc: Document): boolean {
  if (!careerAddress(doc.location.href) || !headline(doc) || !hasApplyButton(doc)) return false;
  return sectionCount(doc) >= 3;
}

// What only a job application asks.
const APPLICATION_ONLY = new Set<FieldPurpose>([
  'resume', 'cover_letter', 'authorized_to_work', 'needs_sponsorship', 'authorized_no_sponsorship', 'visa_status', 'salary_expectation',
  'notice_period', 'previously_employed', ...ENTRY_PURPOSES,
]);
// What an application asks, and so does a college's, a clinic's or a profile page.
const APPLICATION_TOO = new Set<FieldPurpose>([
  'linkedin', 'github', 'portfolio', 'school', 'degree', 'major', 'graduation_year', 'gpa', 'years_experience', 'start_date', 'willing_to_relocate',
  'gender', 'race', 'hispanic', 'veteran', 'disability',
]);

/**
 * Whether this document itself holds an application form. A contact, demo,
 * checkout or sign-up form asks who you are too, so that alone is never
 * enough: a resume upload beside it is, two things only an application
 * asks are (a later step need not ask who you are again), and on a job's
 * own address so are the usual questions of an application.
 */
export function ownApplicationForm(doc: Document): boolean {
  const url = doc.location.href;
  const atsSite = !!siteFor(doc) || isApplicantHost(doc.location.hostname);
  const applicantSite = atsSite || isJobUrl(url);
  // Cheap: most pages have no form, and web components only hide fields on systems Wera knows.
  if (!applicantSite && doc.querySelectorAll('input, select, textarea').length < 2) return false;
  const raw = collectFields(doc, undefined, true);
  const fields = raw.map(classify);
  const known = fields.filter((p) => p !== null && p !== 'question' && p !== 'consent').length;
  // Some systems start with nothing but the applicant's email (Oracle, iCIMS).
  if (known === 1 && applicantSite && applyStep(url) && fields.includes('email')) return true;
  // On an ATS host or explicit apply step, a resume upload or >= 2 fillable controls (including screening questions) is an application form.
  if (atsSite || (applicantSite && applyStep(url))) {
    if (fields.includes('resume')) return true;
    const fillable = raw.filter((f, i) => !f.trap && fields[i] !== 'consent').length;
    if (fillable >= 2 && (known >= 1 || fields.includes('question'))) return true;
  }
  if (known < 2) return false;
  const only = new Set(fields.filter((p) => p !== null && APPLICATION_ONLY.has(p)));
  const too = new Set(fields.filter((p) => p !== null && APPLICATION_TOO.has(p)));
  const who = fields.some((p) => p === 'email' || p === 'first_name' || p === 'full_name');
  if (only.size >= 2 || (only.has('resume') && who)) return true;
  if (known < 3) return false;
  // The first step of a long application may ask no more than who you are.
  if (applicantSite || careerAddress(url)) return who || only.size + too.size >= 2;
  // Elsewhere an address that says "apply" is as likely a college, a grant or a card: without who
  // you are, it takes a question only an application asks.
  return applyAddress(url) && (who ? only.size + too.size >= 1 : only.size >= 1 && only.size + too.size >= 2);
}

/** Whether the page holds an application form (here or in an embedded applicant system's frame). */
export function hasApplicationForm(doc: Document): boolean {
  if (ownApplicationForm(doc)) return true;
  // A careers page with the application embedded from its applicant system.
  return [...doc.querySelectorAll('iframe')].some((f) => {
    const src = f.getAttribute('src') ?? '';
    if (EMBEDDED_FORM.test(src)) return true;
    try {
      const u = new URL(src, doc.location.href);
      // Any other frame of a system (its job search, say) speaks for itself if it holds a form.
      return isApplicantHost(u.hostname) && /apply|application/i.test(u.pathname);
    } catch {
      return false;
    }
  });
}

/** Whether the page is an application form, one job's posting, or neither. */
/**
 * The document that shows the page. iCIMS puts its whole page in a frame
 * on its own site, around which the top document is empty.
 */
export function pageDocument(doc: Document): Document {
  const frame = doc.querySelector<HTMLIFrameElement>('iframe#icims_content_iframe');
  try {
    return frame?.contentDocument?.body ? frame.contentDocument : doc;
  } catch {
    return doc; // another site's frame
  }
}

/** Whether this document lives on a known applicant system, site rule, or job URL. */
export function isApplicantPage(doc: Document): boolean {
  return !!siteFor(doc) || isApplicantHost(doc.location.hostname) || isJobUrl(doc.location.href);
}

/** Whether the page is a pre-form step (account, consent, or location/language gate) on an applicant system. */
export function hasPreFormGate(doc: Document): boolean {
  if (siteFor(doc)?.gate?.(doc)) return true;
  if (!isApplicantPage(doc)) return false;
  if (readJobPosting(doc, doc.location.href) && findApply(doc)) return false;
  return !!gateOf(doc);
}

export function pageKind(doc: Document): PageKind {
  // The bridge marks the user's own Wera dashboard: its forms are not applications.
  if (doc.documentElement.dataset.weraExtension) return null;
  const url = doc.location.href;
  if (isNotJobSite(url) || insideNotJobSite(doc)) return null;
  const shown = pageDocument(doc);
  if (shown !== doc) return pageKind(shown);
  if (hasApplicationForm(doc) || hasPreFormGate(doc)) return 'form';
  if (readJobPosting(doc, url)) return 'posting';
  // A job's address: its title as the heading, or (a site that heads it otherwise, Jobvite) a way to
  // apply and a posting's sections. A closed job's page has neither, or says it is gone.
  if (isJobUrl(url) && !GONE.test(`${headline(doc)} ${doc.title}`) && (headline(doc) || (hasApplyButton(doc) && sectionCount(doc) >= 2))) return 'posting';
  return readsLikePosting(doc) ? 'posting' : null;
}

/** The company slug in a job board's address ("acme" in jobs.lever.co/acme/...), made readable. */
function companyFromUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return '';
  }
  const first = u.pathname.split('/').filter(Boolean)[0] ?? '';
  let slug = '';
  if (/greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com|workable\.com|rippling\.com|jobvite\.com/.test(u.hostname)) slug = first;
  else if (/myworkdayjobs\.com|icims\.com|bamboohr\.com|recruitee\.com|breezy\.hr|teamtailor\.com|applytojob\.com/.test(u.hostname)) slug = u.hostname.split('.')[0] ?? '';
  if (!slug || slug === 'embed' || slug === 'jobs' || /^\d+$/.test(slug)) return '';
  return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A title without what a form wraps it in: "Apply: SRE", "Job Application for SRE at Acme". */
export function bareTitle(title: string, company: string): string {
  let t = title.replace(/^\s*(job\s+)?(application|apply)\s*(for|to|:|-|–)\s*/i, '').trim();
  const name = company.trim().toLowerCase();
  if (!name) return t;
  const at = t.toLowerCase().lastIndexOf(` at ${name}`);
  if (at > 0) return t.slice(0, at).trim();
  // "Palantir Technologies - Administrative Business Partner", "Engineer | Acme Careers":
  // the part that names the company goes, the other part is the job.
  const parts = t.split(/\s+[-–—|:]\s+/);
  if (parts.length === 2) {
    const [a, b] = parts as [string, string];
    if (a.toLowerCase().startsWith(name) && b.length >= 3) t = b;
    else if (b.toLowerCase().startsWith(name) && a.length >= 3) t = a;
  }
  return t.trim();
}

/** Company name from an ATS page title ("Job Application for SRE at Together AI"). */
function companyFromTitle(docTitle: string): string {
  const m = /\b(?:job\s+application|apply)\s+for\s+.+\s+at\s+([^|–—]+)$/i.exec(docTitle.trim());
  return m?.[1]?.trim() ?? '';
}

/** A first look at the job: its title and company, for the Wera panel's first look (it reads the page fully later). */
export function jobSummary(doc: Document): { title: string; company: string } {
  const data = readJobPosting(doc, doc.location.href);
  if (data) return { title: data.title, company: data.company || companyFromTitle(doc.title) || companyFromUrl(doc.location.href) };
  const meta = (name: string) => doc.querySelector<HTMLMetaElement>(`meta[property="${name}"], meta[name="${name}"]`)?.content?.trim() ?? '';
  // LinkedIn and Indeed name the company next to the title.
  const site = doc.querySelector('.job-details-jobs-unified-top-card__company-name, [data-testid="inlineHeader-companyName"], [data-company-name="true"]')?.textContent?.trim() ?? '';
  const title = headline(doc) || meta('og:title') || doc.title.split(/\s[|–-]\s/)[0]!.trim();
  const company = (site || companyFromTitle(doc.title) || companyFromUrl(doc.location.href) || meta('og:site_name')).slice(0, 80);
  return { title: bareTitle(title, company).slice(0, 140), company };
}
