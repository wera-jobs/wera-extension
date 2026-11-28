// Fit badges on LinkedIn, Indeed, and Glassdoor job-board search lists.
// Reads visible cards, asks the background for Wera's fit score (or quick
// keyword score) and direct company apply link, and renders a small pill
// anchored to each card's own job key so virtualized list recycling never
// puts a badge on the wrong job.
import { extensionAlive, sendSafe } from '../shared/alive';
import type { BadgeQuery, BadgeResult } from '../shared/jobs';
import { isJobSearchUrl } from './urls';

export interface BoardCard extends BadgeQuery {
  el: HTMLElement;
}

const BADGE_ATTR = 'data-wera-badge';
const KEY_ATTR = 'data-wera-badge-key';

function clean(s: string | null | undefined, max = 140): string {
  return (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function linkedInCards(doc: Document): BoardCard[] {
  const out: BoardCard[] = [];
  const cards = doc.querySelectorAll<HTMLElement>('li[data-occludable-job-id], div.job-card-container[data-job-id], li.jobs-search-results__list-item');
  for (const el of cards) {
    const link = el.querySelector<HTMLAnchorElement>('a[href*="/jobs/view/"]');
    const id = el.getAttribute('data-occludable-job-id') || el.getAttribute('data-job-id') || /\/jobs\/view\/(?:[a-z0-9%-]+-)?(\d+)/i.exec(link?.getAttribute('href') ?? '')?.[1] || '';
    if (!id) continue;
    const title = clean(el.querySelector('.job-card-list__title, .job-card-container__link')?.textContent || link?.textContent);
    const company = clean(el.querySelector('.job-card-container__primary-description, .artdeco-entity-lockup__subtitle')?.textContent);
    if (!title) continue;
    const url = `https://www.linkedin.com/jobs/view/${id}/`;
    out.push({ el, key: `li:${id}:${title.toLowerCase()}`, url, title, company, text: clean(el.textContent, 500) });
  }
  return out;
}

function indeedCards(doc: Document): BoardCard[] {
  const out: BoardCard[] = [];
  const host = doc.location?.hostname || 'www.indeed.com';
  const cards = doc.querySelectorAll<HTMLElement>('.job_seen_beacon, li > .cardOutline, div[data-jk]');
  for (const el of cards) {
    const link = el.querySelector<HTMLAnchorElement>('a[data-jk], a.jcs-JobTitle, a[href*="jk="]');
    const jk = el.getAttribute('data-jk') || link?.getAttribute('data-jk') || /[?&]v?jk=([a-z0-9]+)/i.exec(link?.getAttribute('href') ?? '')?.[1] || '';
    if (!jk) continue;
    const title = clean(el.querySelector('h2.jobTitle, a.jcs-JobTitle')?.textContent || link?.textContent);
    const company = clean(el.querySelector('[data-testid="company-name"], .companyName')?.textContent);
    if (!title) continue;
    const url = `https://${host}/viewjob?jk=${jk}`;
    out.push({ el, key: `in:${jk}:${title.toLowerCase()}`, url, title, company, text: clean(el.textContent, 500) });
  }
  return out;
}

function glassdoorCards(doc: Document): BoardCard[] {
  const out: BoardCard[] = [];
  const cards = doc.querySelectorAll<HTMLElement>('li[data-test="jobListing"], div[data-jobid]');
  for (const el of cards) {
    const link = el.querySelector<HTMLAnchorElement>('a[data-test="job-link"], a[href*="/job-listing/"], a[href*="jl="]');
    const href = link?.getAttribute('href') ?? '';
    const id = el.getAttribute('data-jobid') || /[?&]jl=(\d+)|_KO\d+,\d+\.htm/i.exec(href)?.[1] || href;
    if (!id || !href) continue;
    const title = clean(el.querySelector('[data-test="job-title"]')?.textContent || link?.textContent);
    const company = clean(el.querySelector('[data-test="employer-short-name"]')?.textContent);
    if (!title) continue;
    let url = href;
    try {
      url = new URL(href, doc.location.href).href;
    } catch {
      // keep raw href
    }
    out.push({ el, key: `gd:${id}:${title.toLowerCase()}`, url, title, company, text: clean(el.textContent, 500) });
  }
  return out;
}

/** Finds all visible job cards on a LinkedIn, Indeed, or Glassdoor search list. */
export function findBoardCards(doc: Document): BoardCard[] {
  const host = (doc.location?.hostname ?? '').toLowerCase();
  if (/(^|\.)linkedin\.com$/.test(host)) return linkedInCards(doc);
  if (/(^|\.)indeed\.[a-z.]+$/.test(host)) return indeedCards(doc);
  if (/(^|\.)glassdoor\.[a-z.]+$/.test(host)) return glassdoorCards(doc);
  return [];
}

/** Fast local keyword match against a card's title/snippet when Wera has no scored copy yet. */
export function quickSkillScore(text: string, skills: string[]): number | null {
  if (!skills.length) return null;
  const hay = ` ${text.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ')} `;
  let matched = 0;
  const uniq = [...new Set(skills.map((s) => s.trim().toLowerCase()).filter((s) => s.length >= 2))].slice(0, 40);
  for (const s of uniq) {
    if (hay.includes(` ${s} `)) matched++;
  }
  if (!matched) return null;
  // Scale 1..6 matched skills in a short card snippet into a 55..92 quick match estimate.
  return Math.min(92, 48 + matched * 9);
}

/** Renders or updates Wera's fit pill on one job card (never duplicating or misattaching). */
const STATUS_WORDS: Record<string, [string, string, string]> = {
  saved: ['Saved', '#dbeafe', '#1e40af'], applied: ['Applied', '#ede9fe', '#5b21b6'], interviewing: ['Interviewing', '#fef3c7', '#92400e'],
  offer: ['Offer', '#dcfce7', '#166534'], rejected: ['Rejected', '#fee2e2', '#991b1b'], not_interested: ['Dismissed', '#f3f4f6', '#4b5563'],
};

function chip(doc: Document, text: string, bg: string, fg: string, title = ''): HTMLElement {
  const c = doc.createElement('span');
  c.style.cssText = `display:inline-flex;align-items:center;padding:2px 7px;border-radius:999px;background:${bg};color:${fg};`;
  c.textContent = text;
  if (title) c.title = title;
  return c;
}

export function renderBadge(card: BoardCard, res: BadgeResult): void {
  const existing = card.el.querySelector<HTMLElement>(`[${BADGE_ATTR}]`);
  const doc = card.el.ownerDocument;
  if (res.score == null && !res.applyUrl && !res.status && !res.sponsors && !res.early && !res.closed && !card.title) {
    existing?.remove();
    return;
  }
  const badge = existing ?? card.el.ownerDocument.createElement('div');
  badge.setAttribute(BADGE_ATTR, '1');
  badge.setAttribute(KEY_ATTR, card.key);
  badge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-top:4px;font:600 11px/1.2 ui-sans-serif,system-ui,sans-serif;';
  badge.textContent = '';

  if (res.score != null) {
    const pill = card.el.ownerDocument.createElement('span');
    const good = res.score >= 75;
    const mid = res.score >= 55;
    const bg = good ? '#dcfce7' : mid ? '#fef3c7' : '#f3f4f6';
    const fg = good ? '#166534' : mid ? '#92400e' : '#374151';
    pill.style.cssText = `display:inline-flex;align-items:center;padding:2px 7px;border-radius:999px;background:${bg};color:${fg};`;
    pill.textContent = res.source === 'wera' ? `Wera ${res.score}%` : `Wera ~${res.score}%`;
    pill.title = res.source === 'wera' ? 'Wera fit score' : 'Quick skill match from your resume';
    badge.append(pill);
  }

  // What the tracker says, at a glance while scrolling.
  const st = res.status ? STATUS_WORDS[res.status] : undefined;
  if (st) badge.append(chip(doc, st[0], st[1], st[2], 'On your Wera tracker'));
  if (res.closed) badge.append(chip(doc, 'Closed', '#f3f4f6', '#6b7280', 'This posting has come down'));
  if (res.sponsors) badge.append(chip(doc, 'Sponsors visas', '#e0f2fe', '#075985', 'The posting offers visa sponsorship'));
  if (res.early) badge.append(chip(doc, 'Early', '#dcfce7', '#166534', 'Posted in the last three days'));
  // Not on the tracker yet: one click saves it, with its fit score to follow.
  if (!res.status && card.title && card.company) {
    const save = doc.createElement('button');
    save.type = 'button';
    save.textContent = 'Save to Wera';
    save.style.cssText = 'border:1px solid #d1d5db;background:#fff;color:#111827;border-radius:999px;padding:1px 8px;font:inherit;cursor:pointer;';
    save.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      save.disabled = true;
      save.textContent = 'Saving…';
      const item: BadgeQuery = { key: card.key, url: card.url, title: card.title, company: card.company, text: card.text };
      void sendSafe<BadgeResult | null>({ type: 'wera:job-board-save', item }).then((r) => {
        if (r) renderBadge(card, { ...r, key: card.key });
        else {
          save.disabled = false;
          save.textContent = 'Save to Wera';
        }
      });
    });
    badge.append(save);
  }

  // Line it up: Wera fills it in a background tab, and the person reviews and submits it.
  if (!res.closed && (!res.status || res.status === 'saved') && card.title && card.company) {
    const queue = doc.createElement('button');
    queue.type = 'button';
    queue.textContent = 'Queue';
    queue.title = 'Wera fills this application in the background; you review it and press Submit yourself';
    queue.style.cssText = 'border:1px solid #d1d5db;background:#fff;color:#111827;border-radius:999px;padding:1px 8px;font:inherit;cursor:pointer;';
    queue.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      queue.disabled = true;
      queue.textContent = 'Queuing…';
      const item = { key: card.key, url: card.url, title: card.title, company: card.company, text: card.text, ...(res.applyUrl ? { applyUrl: res.applyUrl } : {}) };
      void sendSafe<{ ok: boolean } | null>({ type: 'wera:job-board-queue', item }).then((r) => {
        queue.textContent = r?.ok ? 'Queued ✓' : r ? 'Queue full' : 'Queue';
        queue.disabled = !!r?.ok;
      });
    });
    badge.append(queue);
  }

  if (res.applyUrl && /^https?:\/\//i.test(res.applyUrl)) {
    const a = card.el.ownerDocument.createElement('a');
    a.href = res.applyUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'Company site ↗';
    a.style.cssText = 'color:#2563eb;text-decoration:none;font-weight:500;';
    a.addEventListener('click', (e) => e.stopPropagation());
    badge.append(a);
  }

  card.el.setAttribute(KEY_ATTR, card.key);
  if (!existing) card.el.append(badge);
}

/** Watches a job-board search list and stamps fit badges on newly rendered cards. */
export function watchBoardBadges(doc: Document, delay = 350): () => void {
  const inflight = new Set<string>();
  const done = new Map<string, BadgeResult>();
  let timer = 0;

  const scan = async () => {
    timer = 0;
    if (doc.hidden || !isJobSearchUrl(doc.location.href)) return;
    const cards = findBoardCards(doc);
    const pending: BoardCard[] = [];
    for (const c of cards) {
      const stampedKey = c.el.getAttribute(KEY_ATTR);
      // Recycled card now showing a different job: clear stale badge immediately.
      if (stampedKey && stampedKey !== c.key) {
        c.el.querySelector(`[${BADGE_ATTR}]`)?.remove();
        c.el.removeAttribute(KEY_ATTR);
      }
      const cached = done.get(c.key);
      if (cached) {
        if (c.el.getAttribute(KEY_ATTR) !== c.key) renderBadge(c, cached);
        continue;
      }
      if (!inflight.has(c.key)) pending.push(c);
    }
    const batch = pending.slice(0, 30);
    if (!batch.length) return;
    batch.forEach((c) => inflight.add(c.key));
    try {
      const items: BadgeQuery[] = batch.map(({ key, url, title, company, text }) => ({ key, url, title, company, text }));
      const results = await sendSafe<BadgeResult[] | null>({ type: 'wera:job-badges', items });
      const byKey = new Map((results ?? []).map((r) => [r.key, r]));
      for (const c of batch) {
        const r = byKey.get(c.key) ?? { key: c.key, score: null, source: null };
        done.set(c.key, r);
        // Verify the DOM node still belongs to this card before stamping.
        if (c.el.isConnected) renderBadge(c, r);
      }
    } finally {
      batch.forEach((c) => inflight.delete(c.key));
    }
  };

  const schedule = () => {
    if (!extensionAlive()) return stop();
    if (!timer) timer = window.setTimeout(() => void scan().catch(() => {}), delay);
  };

  const obs = new MutationObserver(schedule);
  obs.observe(doc.body ?? doc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-occludable-job-id', 'data-job-id', 'data-jk', 'data-jobid', 'href'],
  });
  schedule();

  function stop() {
    obs.disconnect();
    window.clearTimeout(timer);
  }
  return stop;
}
