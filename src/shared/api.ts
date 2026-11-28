import type { SavedAnswer } from './answers';
import type { Applicant, Education, Experience, JobDraft } from './types';

export interface ApplicantView {
  applicant: Applicant;
  saved: boolean;
  /** Details filled in (not saved) and where from: "resume" or "profile". */
  sources: Record<string, string>;
  experience: Experience[];
  education: Education[];
  skills: string[];
}

export interface WeraUser {
  id: number;
  email: string;
  name: string;
  is_admin: boolean;
}

/** A job as the Wera API returns it (the fields the extension uses). */
export interface WeraJob {
  id: number;
  company: string;
  title: string;
  url: string;
  location_raw: string | null;
  location_summary: string | null;
  stage: string;
  fit_score: number | null;
  estimated_score: number | null;
  verdict: string | null;
  reason: string | null;
  sponsorship: 'yes' | 'no' | 'unknown' | null;
  skills_matched: string[] | null;
  skills_missing: string[] | null;
  application_status: string | null;
  source: string;
  /** Why the user's rules or the posting's facts rule the job out (stage "excluded"), and the posting's words for it. */
  exclude_reason?: string | null;
  exclude_evidence?: string | null;
  /** When the extension last filled an application for it (absent on older servers). */
  autofilled_at?: string | null;
  /** When the posting went up (its job board's date), when Wera found it, and when it came down. */
  posted_at?: string | null;
  first_seen_at?: string;
  closed_at?: string | null;
  /** Where Wera serves the company's logo (e.g. "/api/companies/7/logo?v=1"); absent when it has none. */
  logo_url?: string | null;
  company_id?: number;
  /** The user follows the company: its new roles show up as a notice. */
  company_followed?: boolean;
  /** Other places the same role is posted. */
  also_in?: string[];
  /** Posted in the last three days and found by Wera: an early applicant. */
  early?: boolean;
  /** The ratings the fit score was computed from, 0-10 each. */
  fit_parts?: { role: number; seniority: number; skills: number; domain: number; location: number; blocker: boolean } | null;
  pay_min?: number | null;
  pay_max?: number | null;
  pay_currency?: string | null;
  pay_period?: string | null;
}

export interface CoverLetter {
  body: string;
  edited: boolean;
}

export interface Coverage {
  matched: string[];
  missing: string[];
  percent: number;
}

export interface ResumeBullet {
  id: string;
  text: string;
  hidden?: boolean;
}

export interface ResumeEntry {
  id: string;
  heading: string;
  subheading?: string;
  dates?: string;
  location?: string;
  tech?: string;
  text?: string;
  url?: string;
  link_label?: string;
  bullets?: ResumeBullet[];
  hidden?: boolean;
}

/** Someone the user logged for a job (see the dashboard's Contacts). */
export interface JobContact {
  id: number;
  job_id: number;
  name: string;
  role: string;
  email: string;
  linkedin_url: string;
  notes: string;
  last_contacted_at: string | null;
  follow_up_at: string | null;
}

export interface ResumeSection {
  id: string;
  kind: 'entries' | 'projects' | 'compact' | 'skills' | 'summary';
  title: string;
  hidden?: boolean;
  entries?: ResumeEntry[];
  skills?: { id: string; name: string; items: string }[];
  text?: string;
}

/** The structured resume (mirrors the API's resume.Resume). */
export interface ResumeData {
  name: string;
  headline?: string;
  phone?: string;
  email?: string;
  location?: string;
  links?: { label: string; url: string }[];
  sections: ResumeSection[];
}

export interface ResumeLayout {
  font_size: number;
  spacing: number;
  margin: number;
  template?: string;
  accent?: string;
  paper?: string;
}

/** A resume document: the main one (job_id null) or a copy tailored to a job. */
export interface ResumeDoc {
  id: number;
  title: string;
  job_id: number | null;
  data: ResumeData;
  layout: ResumeLayout;
  fit: { one_page: boolean; summary: string } | null;
  notes: string[];
  coverage?: Coverage;
  /** For a copy tailored to a job: the job's fit score, and what it is with this resume. */
  fit_score?: { before: number; after: number };
}

export interface ResumeTemplate {
  id: string;
  name: string;
  tagline: string;
  uses_accent: boolean;
}

/** How a cover letter should read (all optional). */
export interface LetterSteer {
  tone?: '' | 'warm' | 'formal' | 'confident' | 'enthusiastic' | 'concise';
  length?: '' | 'short' | 'standard' | 'long';
  request?: string;
}

/** A field sent for an AI suggestion (see /api/ext/autofill). */
export interface SuggestField {
  id: string;
  label: string;
  kind: string;
  options?: string[];
  required?: boolean;
  max_length?: number;
}

export interface Suggestion {
  id: string;
  value: string;
  confidence: 'high' | 'low';
  why?: string;
}

/** One application the extension helped fill. */
export interface AutofillRun {
  id: number;
  job_id: number | null;
  host: string;
  pages: number;
  filled: number;
  suggested: number;
}

export interface JobKeywords {
  keywords: string[];
  coverage: Coverage | null;
  /** The base resume, or null when the user has not set one up. */
  resume_id: number | null;
}

/** A file to attach to an application form. */
export interface ResumeFile {
  id?: number;
  name: string;
  base64: string;
  /** Which resume it is: tailored to this job, the main one, or the uploaded file. */
  kind: 'tailored' | 'base' | 'upload';
}

/** One saved resume in the user's Wera account, for choosing which one to attach. */
export interface ResumeSummary {
  id: number;
  title: string;
  job_id: number | null;
  /** The base resume used unless another is chosen (a user may keep several: ML, Backend...). */
  is_default?: boolean;
  /** For a tailored copy: the base resume it was written from. */
  base_id?: number | null;
  fit_score?: { before: number; after: number } | null;
}

/** What went into an application's file fields on a page: the resume (which one) and a cover letter. */
export interface RunAttachments {
  resume?: Pick<ResumeFile, 'kind' | 'name'>;
  letter?: boolean;
}

const attachments = (a: RunAttachments) => ({
  ...(a.resume ? { resume: { kind: a.resume.kind, name: a.resume.name.slice(0, 200) } } : {}),
  ...(a.letter ? { letter: true } : {}),
});

/** A company's H-1B filings and what it offered for titles like a job's. */
export interface JobH1B {
  matched: boolean;
  filings: number;
  new_hires: number;
  wage_median: number | null;
  similar: { title: string; wage_from: number | null; wage_to: number | null; level: string; place: string }[];
  similar_low: number | null;
  similar_high: number | null;
  level: string;
}

export type ApplicationStatus = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'not_interested';

/** POSTs that only compute something (nothing in Wera changes). */
const READ_ONLY = /^\/api\/(ext\/(extract|answer|tokens|autofill(?!-))|resumes\/(preview|suggest-bullet))/;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The Wera API, called from the side panel (an extension page with host
 * permission for the server, so no CORS) with the extension's bearer token.
 */
export class WeraApi {
  constructor(
    readonly server: string,
    private token = '',
    private readonly fetcher: typeof fetch = (...a) => fetch(...a),
    /** Called after a request that changed the user's data (the panel tells the dashboard). */
    private readonly onChange?: (path: string) => void,
  ) {}

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (init.body != null) headers['Content-Type'] = 'application/json';
    let res: Response;
    try {
      res = await this.fetcher(`${this.server}${path}`, { ...init, headers, credentials: 'omit' });
    } catch {
      throw this.unreachable();
    }
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        msg = ((await res.json()) as { error?: string }).error ?? msg;
      } catch {
        // not JSON
      }
      throw new ApiError(res.status, msg);
    }
    if (init.method && init.method !== 'GET' && !READ_ONLY.test(path)) this.onChange?.(path);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private unreachable() {
    return new ApiError(0, `Can't reach your Wera server at ${this.server}. Check that it is running and that the address is right.`);
  }

  async connect(email: string, password: string, name: string) {
    const r = await this.call<{ token: string; user: WeraUser }>('/api/ext/tokens', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    this.token = r.token;
    return r;
  }

  disconnect() {
    return this.call<void>('/api/ext/tokens/current', { method: 'DELETE' });
  }

  me() {
    return this.call<{ user: WeraUser }>('/api/auth/me');
  }

  lookup(url: string) {
    return this.call<{ job: WeraJob | null }>(`/api/ext/jobs/lookup?url=${encodeURIComponent(url)}`);
  }

  /** The user's job for each address, in order (null where Wera has none): one request for a board's cards. */
  async lookupMany(urls: string[]): Promise<(WeraJob | null)[]> {
    try {
      return (await this.call<{ jobs: (WeraJob | null)[] }>('/api/ext/jobs/lookup-batch', { method: 'POST', body: JSON.stringify({ urls }) })).jobs;
    } catch (e) {
      // An older server: one request each.
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return Promise.all(urls.map((u) => this.lookup(u).then((r) => r.job, () => null)));
      throw e;
    }
  }

  job(id: number) {
    return this.call<WeraJob>(`/api/jobs/${id}`);
  }

  async extract(url: string, title: string, text: string) {
    const d = await this.call<JobDraft & { is_job_posting: boolean }>('/api/ext/extract', {
      method: 'POST',
      body: JSON.stringify({ url, title, text }),
    });
    return { ...d, url: d.url || url };
  }

  addJob(d: JobDraft) {
    return this.call<WeraJob>('/api/ext/jobs', { method: 'POST', body: JSON.stringify(d) });
  }

  /**
   * The user's best match after this application, for the moment they have
   * momentum: one they have not dealt with yet, or only saved.
   */
  async nextMatch(after: number | null): Promise<WeraJob | null> {
    const { jobs } = await this.call<{ jobs: WeraJob[] }>('/api/today?limit=10');
    return jobs.find((j) => j.id !== after && (!j.application_status || j.application_status === 'saved')) ?? null;
  }

  /**
   * The application details, completed from the profile and the resume
   * (sources says which came from where), with the resume's jobs, schools
   * and skills. Older servers send only applicant and saved.
   */
  async applicant(): Promise<ApplicantView> {
    const r = await this.call<Partial<ApplicantView> & { applicant: Applicant; saved: boolean }>('/api/applicant');
    return { sources: {}, experience: [], education: [], skills: [], ...r };
  }

  coverLetter(jobId: number) {
    return this.call<CoverLetter>(`/api/jobs/${jobId}/cover-letter`).catch((e) => {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    });
  }

  /** Writes a new letter (with an optional steer), or saves the user's edits (body). */
  writeCoverLetter(jobId: number, body?: string, steer?: LetterSteer) {
    return this.call<CoverLetter>(`/api/jobs/${jobId}/cover-letter`, {
      method: body == null ? 'POST' : 'PUT',
      body: body != null ? JSON.stringify({ body }) : steer ? JSON.stringify(steer) : undefined,
    });
  }

  /** Sets the job's status in the tracker (notes stay as they are). */
  /** The people the user logged for a job (recruiters, referrers). */
  jobContacts(jobId: number) {
    return this.call<{ contacts: JobContact[] }>(`/api/jobs/${jobId}/contacts`).then((r) => r.contacts);
  }

  addContact(jobId: number, c: Pick<JobContact, 'name'> & Partial<Pick<JobContact, 'role' | 'linkedin_url' | 'notes' | 'follow_up_at' | 'last_contacted_at'>>) {
    return this.call<JobContact>(`/api/jobs/${jobId}/contacts`, { method: 'POST', body: JSON.stringify(c) });
  }

  /** Adds a skill to the profile; with a job, that job is scored again and returned. */
  addSkill(skill: string, jobId?: number) {
    return this.call<{ job?: WeraJob }>('/api/profile/skills', { method: 'POST', body: JSON.stringify({ skill, ...(jobId != null ? { job_id: jobId } : {}) }) });
  }

  /** Follows a company (its new roles show up as a notice), or stops. */
  followCompany(companyId: number, follow: boolean) {
    return this.call<void>(`/api/companies/${companyId}/follow`, { method: follow ? 'PUT' : 'DELETE' });
  }

  setStatus(jobId: number, status: ApplicationStatus) {
    return this.call<WeraJob>(`/api/jobs/${jobId}/application`, { method: 'PUT', body: JSON.stringify({ status }) });
  }

  h1b(jobId: number) {
    return this.call<JobH1B>(`/api/jobs/${jobId}/h1b`);
  }

  jobKeywords(jobId: number) {
    return this.call<JobKeywords>(`/api/jobs/${jobId}/keywords`);
  }

  /** A job page's keywords and the main resume's share of them, for a job not in Wera (word matching, no AI). */
  postingKeywords(description: string) {
    return this.call<JobKeywords>('/api/ext/keywords', { method: 'POST', body: JSON.stringify({ description: description.slice(0, 60000) }) });
  }

  /** The resume tailored to this job, or null if there is none yet. */
  async jobResume(jobId: number): Promise<ResumeDoc | null> {
    try {
      return await this.call<ResumeDoc>(`/api/jobs/${jobId}/resume`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }

  /** Writes a copy of a base resume (the default one unless baseId names another) toward the job. */
  tailorResume(jobId: number, request = '', baseId?: number | null) {
    const body = { ...(request.trim() ? { request: request.trim() } : {}), ...(baseId != null ? { base_resume_id: baseId } : {}) };
    return this.call<{ resume: ResumeDoc; coverage_before: Coverage }>(`/api/jobs/${jobId}/resume`, {
      method: 'POST',
      body: Object.keys(body).length ? JSON.stringify(body) : undefined,
    });
  }

  /** The main resume, or null when there is none yet. */
  async baseResume(): Promise<ResumeDoc | null> {
    const { resumes } = await this.call<{ resumes: { id: number; job_id: number | null }[] }>('/api/resumes');
    const base = resumes.find((r) => r.job_id == null);
    return base ? this.call<ResumeDoc>(`/api/resumes/${base.id}`) : null;
  }

  /** Creates the main resume: from the uploaded file (the AI arranges it) or a starter from the account. */
  createResume(source: 'profile' | 'blank') {
    return this.call<ResumeDoc>('/api/resumes/import', { method: 'POST', body: JSON.stringify({ source }) });
  }

  saveResume(doc: ResumeDoc) {
    return this.call<ResumeDoc>(`/api/resumes/${doc.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: doc.title, data: doc.data, layout: doc.layout }),
    });
  }

  /** Lays the resume out on one page (dropping the least relevant bullets if it must). */
  fitResume(id: number) {
    return this.call<ResumeDoc>(`/api/resumes/${id}/fit`, { method: 'POST' });
  }

  resumeTemplates() {
    return this.call<{ templates: ResumeTemplate[] }>('/api/resumes/templates');
  }

  /** Three stronger rewrites of one bullet (never with invented numbers). */
  suggestBullet(text: string, role: string, jobId: number | null) {
    return this.call<{ suggestions: string[] }>('/api/resumes/suggest-bullet', {
      method: 'POST',
      body: JSON.stringify({ text, role, job_id: jobId ?? 0 }),
    });
  }

  /** Renders a resume document to SVG pages. */
  previewResume(doc: ResumeDoc) {
    return this.call<{ pages: string[]; measure: { pages: number; fill: number } }>('/api/resumes/preview', {
      method: 'POST',
      body: JSON.stringify({ data: doc.data, layout: doc.layout }),
    });
  }

  /**
   * Drafts an answer to an application question, for the saved job, or
   * else for the posting on the page (company, title, description). With
   * a draft and the user's steer ("shorter", "mention the migration"), it
   * reworks that draft instead.
   */
  async answer(question: string, jobId: number | null, maxWords = 150, posting?: { company: string; title: string; description: string }, rework?: { draft?: string; instructions?: string }) {
    const a = await this.call<{ answer?: string; needs_input?: string }>('/api/ext/answer', {
      method: 'POST',
      body: JSON.stringify({
        question, job_id: jobId ?? 0, max_words: maxWords,
        ...(rework?.draft ? { draft: rework.draft.slice(0, 8000) } : {}),
        ...(rework?.instructions ? { instructions: rework.instructions.slice(0, 600) } : {}),
        ...(jobId == null && posting ? { company: posting.company, title: posting.title, description: posting.description.slice(0, 8000) } : {}),
      }),
    });
    // An older server can leave the AI's request marker in the text: it never goes in a form.
    const [answer, asks] = splitNeedsInput(a.answer ?? '');
    const needs = [a.needs_input, asks].filter(Boolean).join('; ');
    return { ...(answer ? { answer } : {}), ...(needs ? { needs_input: needs } : {}) };
  }

  /** Answers the user gave on forms (empty on a Wera too old to keep them). */
  /** Forgets one saved answer. */
  deleteAnswer(id: number) {
    return this.call<void>(`/api/applicant/answers/${id}`, { method: 'DELETE' });
  }

  async answers(): Promise<SavedAnswer[]> {
    try {
      const r = await this.call<{ answers: { id: number; question: string; answer: string; kind: SavedAnswer['kind']; company: string; updated_at: string }[] }>('/api/applicant/answers');
      return r.answers.map((a) => ({ id: a.id, question: a.question, answer: a.answer, kind: a.kind, company: a.company, at: Date.parse(a.updated_at) || 0 }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return [];
      throw e;
    }
  }

  /** Remembers answers (the same question replaces its earlier answer). */
  saveAnswers(list: { question: string; answer: string; kind?: SavedAnswer['kind']; company?: string }[]) {
    return this.call<{ answers: unknown[] }>('/api/applicant/answers', { method: 'PUT', body: JSON.stringify({ answers: list.slice(0, 80) }) });
  }

  forgetAnswers() {
    return this.call<void>('/api/applicant/answers', { method: 'DELETE' });
  }

  /** AI answers for one page's fields that Wera could not fill from what it knows. */
  suggest(fields: SuggestField[], jobId: number | null, posting?: { company: string; title: string; description: string }) {
    return this.call<{ answers: Suggestion[] }>('/api/ext/autofill', {
      method: 'POST',
      body: JSON.stringify({
        fields: fields.slice(0, 60), job_id: jobId ?? 0,
        ...(jobId == null && posting ? { company: posting.company, title: posting.title, description: posting.description.slice(0, 8000) } : {}),
      }),
    });
  }

  startRun(host: string, jobId: number | null, filled: number, suggested: number, sent: RunAttachments = {}) {
    return this.call<AutofillRun>('/api/ext/autofill-runs', { method: 'POST', body: JSON.stringify({ host, job_id: jobId ?? 0, filled, suggested, ...attachments(sent) }) });
  }

  addRunPage(runId: number, filled: number, suggested: number, sent: RunAttachments = {}) {
    return this.call<AutofillRun>(`/api/ext/autofill-runs/${runId}/pages`, { method: 'POST', body: JSON.stringify({ filled, suggested, ...attachments(sent) }) });
  }

  /** "Report a problem": the person's note, the page and the diagnostics, for the Wera team. */
  reportProblem(r: { note: string; page: string; version: string; details: string }) {
    return this.call<{ id: number }>('/api/ext/reports', { method: 'POST', body: JSON.stringify(r) });
  }

  /** Saves application details (all of them; merge before calling). */
  saveApplicant(a: Applicant) {
    return this.call<{ applicant: Applicant; saved: boolean }>('/api/applicant', { method: 'PUT', body: JSON.stringify(a) });
  }

  private async download(path: string, fallback = 'resume.pdf'): Promise<{ name: string; base64: string } | null> {
    let res: Response;
    try {
      res = await this.fetcher(`${this.server}${path}`, { headers: { Authorization: `Bearer ${this.token}` }, credentials: 'omit' });
    } catch {
      throw this.unreachable();
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new ApiError(res.status, res.status === 401 ? 'unauthorized' : `${res.status} ${res.statusText}`);
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallback;
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { name, base64: btoa(bin) };
  }

  /** The job's cover letter as a PDF, for forms that want a file (null: none written yet). */
  async coverLetterPdf(jobId: number) {
    return this.download(`/api/jobs/${jobId}/cover-letter/pdf?download=1`, 'Cover_Letter.pdf');
  }

  /** A resume PDF by document id. */
  async resumeDocPdf(id: number) {
    return this.download(`/api/resumes/${id}/pdf?download=1`);
  }

  /** Lists the user's resumes (base and tailored copies) for choosing which one to attach. */
  async listResumes(): Promise<ResumeSummary[]> {
    const { resumes } = await this.call<{ resumes: ResumeSummary[] }>('/api/resumes').catch(() => ({ resumes: [] }));
    return resumes ?? [];
  }

  /** Downloads one chosen resume document as a PDF ready to attach. */
  async resumeFileById(id: number, kind: ResumeFile['kind'] = 'base'): Promise<ResumeFile | null> {
    const f = await this.resumeDocPdf(id).catch(() => null);
    return f ? { ...f, id, kind } : null;
  }

  /**
   * The best resume to attach for a job: the copy tailored to it, else
   * the main resume, else the uploaded file; null if there is none.
   */
  async resumeFile(jobId: number | null, preferId?: number | null): Promise<ResumeFile | null> {
    const { resumes } = await this.call<{ resumes: ResumeSummary[] }>('/api/resumes').catch(() => ({ resumes: [] as ResumeSummary[] }));
    // The one the user chose in the panel, else this job's tailored copy, else the default base resume.
    const doc = (preferId != null && resumes.find((r) => r.id === preferId))
      || (jobId != null && resumes.find((r) => r.job_id === jobId))
      || resumes.find((r) => r.job_id == null && r.is_default) || resumes.find((r) => r.job_id == null);
    if (doc) {
      const f = await this.resumeDocPdf(doc.id).catch(() => null);
      if (f) return { ...f, id: doc.id, kind: doc.job_id == null ? 'base' : 'tailored' };
    }
    const up = await this.download('/api/profile/resume/file?download=1');
    return up && { ...up, kind: 'upload' };
  }

  dashboardUrl(path = '/') {
    return `${this.server}${path}`;
  }
}

/** Splits an AI reply at its request marker ("NEEDS_INPUT: …"): the text for the form, and what it asks the person for. */
export function splitNeedsInput(text: string): [string, string] {
  const m = /\bneeds[_ ]input\s*:/i.exec(text);
  return m ? [text.slice(0, m.index).trim(), text.slice(m.index + m[0].length).trim()] : [text, ''];
}
