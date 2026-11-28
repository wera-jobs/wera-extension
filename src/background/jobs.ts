// The background's side of the job page: it looks the page's job up in
// Wera, learns details from forms, and marks a job applied when the site confirms
// the application. Signed-in calls happen here, never in the page.
import { addToQueue } from '../shared/queue';
import { WeraApi, type WeraJob } from '../shared/api';
import { notifyDashboard, sameRole, tabHandoff } from '../shared/bridge';
import { answerKey } from '../shared/answers';
import { learnedDetails } from '../shared/details';
import type { LearnedAnswer } from '../shared/learn';
import { briefOf, PAST_APPLIED, type BadgeQuery, type BadgeResult, type JobConfirmed, type JobRequest, type JobContext, type SubmitReply } from '../shared/jobs';
import { log } from '../shared/log';
import { loadFlow, saveFlow } from '../shared/flow';
import { clearProfileCache, loadProfileCache } from '../shared/profileCache';
import { loadSettings } from '../shared/settings';
import { loadSession, notePage, recentTabJob, rememberTabJob, tabJob, tabPages as pages } from '../shared/storage';
import { hostOf, originOf, siteOf } from '../shared/url';
import type { FieldPurpose } from '../shared/types';
import { quickSkillScore } from '../content/boardBadges';

const FORM_TTL = 3 * 3600_000;
/** How soon after Submit the site's confirmation counts as the answer to it (closing the tab). */
const SEND_TTL = 5 * 60_000;

/** The signed-in API (null when signed out), telling open dashboards what changed. */
export async function signedInApi(): Promise<WeraApi | null> {
  const s = await loadSession();
  return s ? new WeraApi(s.server, s.token, undefined, (path) => void notifyDashboard(s.server, path)) : null;
}

/** Whether a cross-origin ATS page (URL or title) clearly belongs to the candidate job. */
function matchesCrossOriginJob(url: string, title: string, job: WeraJob): boolean {
  if (title && sameRole(title, job.title)) return true;
  const company = job.company.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (company.length < 3) return false;
  const hay = `${url} ${title}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  return hay.includes(company);
}

/**
 * The job a tab is on: by its address, else by the page it came from on
 * the same site (the posting whose Apply button led here), else the one
 * this tab showed on the same site, else the one the dashboard opened it
 * for, else the one an autofill in progress is for, else a recent
 * cross-origin Apply redirect whose ATS URL or title matches the job.
 */
export async function resolveJob(api: WeraApi, tabId: number, url: string, title = '', referrer = ''): Promise<WeraJob | null> {
  const origin = originOf(url);
  let job = await api.lookup(url).then((r) => r.job).catch(() => null);
  if (!job && referrer && referrer !== url && originOf(referrer) === origin) job = await api.lookup(referrer).then((r) => r.job).catch(() => null);
  if (!job) {
    const remembered = await tabJob(tabId, origin);
    if (remembered) job = await api.job(remembered).catch(() => null);
  }
  if (!job) {
    const h = await tabHandoff(tabId);
    const handed = h ? await api.job(h.jobId).catch(() => null) : null;
    if (handed && (!title || sameRole(title, handed.title))) job = handed;
  }
  if (!job && origin) {
    const flow = await loadFlow(tabId, hostOf(url));
    if (flow?.jobId) job = await api.job(flow.jobId).catch(() => null);
  }
  if (!job && referrer && referrer !== url && originOf(referrer) !== origin) {
    const fromRef = await api.lookup(referrer).then((r) => r.job).catch(() => null);
    if (fromRef && matchesCrossOriginJob(url, title, fromRef)) job = fromRef;
  }
  if (!job) {
    const recent = await recentTabJob(tabId);
    const cand = recent ? await api.job(recent).catch(() => null) : null;
    if (cand && matchesCrossOriginJob(url, title, cand)) job = cand;
  }
  if (job && origin) await rememberTabJob(tabId, origin, job.id);
  return job;
}

/** The fit score on the toolbar icon for the tab (a check for a job without one, nothing without a job). */
export function setBadge(tabId: number, job: WeraJob | null) {
  if (!chrome.action?.setBadgeText) return;
  const score = job ? (job.fit_score ?? job.estimated_score) : null;
  void chrome.action.setBadgeText({ tabId, text: score != null ? String(score) : job ? '✓' : '' }).catch(() => {});
  if (score != null) void chrome.action.setBadgeBackgroundColor({ tabId, color: score >= 80 ? '#1e7a3c' : score >= 65 ? '#3157c4' : '#6b7180' }).catch(() => {});
}

/** Tells the tab's Wera panel that the tab's job changed (applied). */
function broadcast(tabId: number, job: WeraJob, applied = false) {
  setBadge(tabId, job);
  void chrome.tabs.sendMessage(tabId, { type: 'wera:job-changed', job, applied }, { frameId: 0 }).catch(() => {});
}

/** Answers one request about the tab's job from its page script or panel. */
export async function handleJobRequest(msg: JobRequest, tabId: number, tabUrl: string, frameId = 0): Promise<unknown> {
  const api = await signedInApi();
  switch (msg.type) {
    case 'wera:job-seen':
      // The panel looks the job up itself; this only notes what the tab showed (for confirmations).
      await notePage(tabId, {
        ...(msg.kind === 'form' ? { formAt: Date.now(), formHost: hostOf(tabUrl) } : {}),
        ...(msg.draft ? { draft: msg.draft } : {}),
      });
      return true;
    case 'wera:job-sending':
      await notePage(tabId, { sentAt: Date.now() });
      return true;
    case 'wera:job-continuing': {
      const host = hostOf(tabUrl);
      const flow = host ? await loadFlow(tabId, host) : null;
      if (flow) await saveFlow(tabId, { ...flow, continuing: true, pages: flow.pages + 1, at: Date.now() });
      return true;
    }
    case 'wera:job-submitted': {
      const reply: SubmitReply = api ? await submitted(api, tabId, msg.url, tabUrl) : { state: 'off' };
      // A form embedded from its ATS confirmed: the panel (top frame) says so.
      if (frameId !== 0 && reply.state !== 'off') {
        void chrome.tabs.sendMessage(tabId, { type: 'wera:job-confirmed', reply } satisfies JobConfirmed, { frameId: 0 }).catch(() => {});
      }
      return reply;
    }
    case 'wera:job-learn': {
      if (!api) return null;
      const [keys] = await Promise.all([
        msg.entries.length ? learnDetails(api, msg.entries) : Promise.resolve([] as string[]),
        msg.answers?.length ? learnAnswers(api, tabId, msg.answers) : Promise.resolve(0),
      ]);
      return keys;
    }
    case 'wera:job-remember':
      await rememberTabJob(tabId, originOf(tabUrl), msg.jobId);
      return true;
    case 'wera:job-resolve': {
      const job = api ? await resolveJob(api, tabId, msg.url, msg.title, msg.referrer) : null;
      setBadge(tabId, job);
      return job;
    }
    case 'wera:job-context': {
      const draft = (await pages())[tabId]?.draft;
      const job = api ? await resolveJob(api, tabId, tabUrl, draft?.title).catch(() => null) : null;
      const posting = draft ? { company: draft.company, title: draft.title, description: draft.description } : null;
      return { jobId: job?.id ?? null, posting: job ? { company: job.company, title: job.title, description: '' } : posting } satisfies JobContext;
    }
    case 'wera:job-badges':
      return api ? scoreBoardCards(api, msg.items) : [];
    case 'wera:job-board-save': {
      if (!api) return null;
      const { item } = msg;
      if (!item.title || !item.company || !/^https?:\/\//.test(item.url)) return null;
      const job = await api.addJob({ url: item.url, company: item.company, title: item.title, location: '', work_mode: '', employment_type: '', department: '', salary: '', industry: '', description: item.text.slice(0, 4000), source: 'manual' });
      const res = badgeFor(item, job, []);
      badgeCache.set(item.url, { at: Date.now(), res });
      return res;
    }
    case 'wera:job-board-queue': {
      if (!api) return null;
      const { item } = msg;
      if (!item.title || !item.company || !/^https?:\/\//.test(item.url)) return null;
      const job = await api.addJob({ url: item.url, company: item.company, title: item.title, location: '', work_mode: '', employment_type: '', department: '', salary: '', industry: '', description: item.text.slice(0, 4000), source: 'manual' }).catch(() => null);
      // The company's own application when the board knows it: the queue fills that page.
      const url = item.applyUrl && /^https?:\/\//.test(item.applyUrl) ? item.applyUrl : item.url;
      const ok = await addToQueue({ url, title: item.title, company: item.company, ...(job ? { jobId: job.id } : {}) });
      return { ok };
    }
    default:
      return null;
  }
}

/**
 * Saves the details a form had that Wera lacked, as the user entered
 * them (see shared/details.ts). Returns the keys saved.
 */
export async function learnDetails(api: WeraApi, entries: { purpose: FieldPurpose; value: string }[]): Promise<string[]> {
  const view = await api.applicant();
  const learned = learnedDetails(view.applicant, entries);
  const keys = Object.keys(learned);
  if (keys.length) {
    await api.saveApplicant({ ...view.applicant, ...learned });
    void clearProfileCache();
  }
  log.info('jobs', keys.length ? `learned ${keys.join(', ')} from the form` : 'nothing new to learn from the form');
  return keys;
}

const BOARD_HOST = /(^|\.)(linkedin\.com|indeed\.[a-z.]+|glassdoor\.[a-z.]+)$/i;
const badgeCache = new Map<string, { at: number; res: BadgeResult }>();

/** Forgets the job boards' badges (the user's jobs changed in the dashboard). */
export function clearBadgeCache() {
  badgeCache.clear();
}
const BADGE_TTL = 10 * 60_000;

/** Looks up Wera's fit score (or falls back to quick resume-skill match) for search-list cards. */
/** A card's badge from the user's job (score, tracker status, sponsorship, early, closed), else a quick skill match. */
function badgeFor(item: BadgeQuery, found: WeraJob | null, skills: string[]): BadgeResult {
  if (found) {
    const direct = found.url && !BOARD_HOST.test(hostOf(found.url)) ? found.url : undefined;
    const score = found.fit_score ?? found.estimated_score;
    return {
      key: item.key, score: score ?? null, source: score != null ? 'wera' : null, ...(direct ? { applyUrl: direct } : {}),
      status: found.application_status, sponsors: found.sponsorship === 'yes', early: !!found.early, closed: !!found.closed_at,
    };
  }
  const quick = quickSkillScore(`${item.title} ${item.text}`, skills);
  return { key: item.key, score: quick, source: quick != null ? 'keywords' : null };
}

async function scoreBoardCards(api: WeraApi, items: BadgeQuery[]): Promise<BadgeResult[]> {
  const cached = await loadProfileCache(api.dashboardUrl('')).catch(() => null);
  const skills = cached?.view.skills ?? (await api.applicant().then((v) => v.skills).catch(() => [] as string[]));
  const out: BadgeResult[] = [];
  const todo: BadgeQuery[] = [];
  for (const item of items.slice(0, 50)) {
    const hit = badgeCache.get(item.url);
    if (hit && Date.now() - hit.at < BADGE_TTL) out.push({ ...hit.res, key: item.key });
    else todo.push(item);
  }
  if (!todo.length) return out;
  // One request for all the cards (older servers: one each).
  const found = await api.lookupMany(todo.map((i) => i.url)).catch(() => todo.map(() => null));
  todo.forEach((item, i) => {
    const res = badgeFor(item, found[i] ?? null, skills);
    badgeCache.set(item.url, { at: Date.now(), res });
    out.push(res);
  });
  return out;
}

/** Whether a confirmation on this page answers the form the tab showed: on the form's own site (or in a frame of it). */
function sameApplication(seen: { formHost?: string } | undefined, url: string, tabUrl: string): boolean {
  if (!seen?.formHost) return true;
  const site = siteOf(seen.formHost);
  return siteOf(hostOf(url)) === site || siteOf(hostOf(tabUrl)) === site;
}

/**
 * Remembers the answers the user gave on a form they moved on, for the
 * next form (when they want that), leaving out those Wera has already.
 * A form in a frame does not know its company: the tab's posting does.
 * Returns how many were saved.
 */
export async function learnAnswers(api: WeraApi, tabId: number, answers: LearnedAnswer[]): Promise<number> {
  if (!(await loadSettings()).learn) return 0;
  const [bank, seen] = await Promise.all([api.answers().catch(() => []), pages().then((p) => p[tabId])]);
  const known = new Map(bank.map((a) => [answerKey(a.question), a.answer]));
  const company = seen?.draft?.company ?? '';
  const fresh = answers
    .filter((a) => known.get(answerKey(a.question)) !== a.answer)
    .map((a) => ({ ...a, company: a.company || company }));
  if (fresh.length) {
    await api.saveAnswers(fresh);
    void clearProfileCache();
  }
  log.info('jobs', fresh.length ? `remembered ${fresh.length} answer(s) from the form` : 'no new answers to remember');
  return fresh.length;
}

/**
 * The site confirmed an application. When this tab showed a form on the
 * same site lately (so it is the user's own application, not a page that
 * merely says the words, like a mail inbox), the job moves to Applied.
 * When the user clicked Submit moments ago, a job not in Wera yet is
 * added from its posting, and the reply asks to close the tab (if the
 * user wants that).
 */
async function submitted(api: WeraApi, tabId: number, url: string, tabUrl = url): Promise<SubmitReply> {
  const settings = await loadSettings();
  const seen = (await pages())[tabId];
  const host = hostOf(url);
  const flow = host ? await loadFlow(tabId, host) : null;
  const formSeen = !!seen?.formAt && Date.now() - seen.formAt < FORM_TTL && sameApplication(seen, url, tabUrl);
  if (!settings.autoApplied || (!flow && !formSeen)) return { state: 'off' };
  const sent = !!seen?.sentAt && Date.now() - seen.sentAt < SEND_TTL;
  const close = sent && settings.closeTabAfterApply;
  if (sent) await notePage(tabId, { sentAt: 0 });
  let job = (await resolveJob(api, tabId, url)) ?? (tabUrl !== url ? await resolveJob(api, tabId, tabUrl) : null);
  let added = false;
  if (!job && sent && seen?.draft) {
    job = await api.addJob(seen.draft).catch((e: unknown) => {
      log.warn('jobs', 'adding the applied job failed', e);
      return null;
    });
    added = !!job;
  }
  if (!job) {
    const d = seen?.draft;
    return { state: 'unknown', draft: d ? { title: d.title, company: d.company } : null, close };
  }
  if (job.application_status && PAST_APPLIED.has(job.application_status)) return { state: 'already', job: briefOf(job), close };
  const updated = await api.setStatus(job.id, 'applied');
  await notePage(tabId, { formAt: 0 });
  broadcast(tabId, updated, true);
  return { state: 'marked', job: briefOf(updated), previous: added ? null : job.application_status, added, close };
}
