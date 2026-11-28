// Lightweight detector that runs in every frame of every page (< 15 KB).
// On non-job pages it does only cheap URL/DOM checks and never loads the
// full form engine (page.js). When a page looks like a job posting,
// application form, or submission confirmation, it wakes page.js via the
// background service worker and steps aside.
import { isApplicantHost } from '../content/frames';
import { looksSubmitted, submittedAddress } from '../content/submitted';
import { applyAddress, careerAddress, EMBEDDED_FORM, insideNotJobSite, isJobSearchUrl, isJobUrl, isNotJobHost, isNotJobSite } from '../content/urls';
import { extensionAlive, sendSafe } from '../shared/alive';

declare global {
  interface Window {
    __weraDetector?: boolean;
  }
}

/** Fast, layout-free check for whether a document might be a job page, application form, or confirmation. */
export function couldBeJobPage(doc: Document): boolean {
  if (doc.documentElement?.dataset?.weraExtension) return false;
  const url = doc.location?.href ?? '';
  if (!url || isNotJobSite(url) || insideNotJobSite(doc)) return false;
  if (isJobUrl(url) || isJobSearchUrl(url) || isApplicantHost(doc.location.hostname) || careerAddress(url) || applyAddress(url) || submittedAddress(url)) return true;
  if (doc.querySelector('iframe#icims_content_iframe, [data-automation-id="applyFlowPage"], [data-automation-id^="formField-"]')) return true;
  // A file box alone is everywhere (GitHub, Jira, banks, drives): only one asking for a resume or CV counts.
  for (const input of doc.querySelectorAll<HTMLInputElement>('input[type="file"]')) {
    const near = `${input.name} ${input.id} ${input.getAttribute('aria-label') ?? ''} ${input.closest('label, fieldset, div')?.textContent?.slice(0, 300) ?? ''}`;
    if (/r[eé]sum[eé]|\bcv\b|curriculum|lebenslauf|cover.?letter/i.test(near)) return true;
  }
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    if (/JobPosting/i.test(s.textContent ?? '')) return true;
  }
  for (const f of doc.querySelectorAll('iframe')) {
    const src = f.getAttribute('src') ?? '';
    if (EMBEDDED_FORM.test(src)) return true;
    try {
      const u = new URL(src, url);
      if (isApplicantHost(u.hostname)) return true;
    } catch {
      // ignore invalid iframe src
    }
  }
  const text = doc.body?.textContent ?? '';
  if (text.length < 40000 && looksSubmitted(text)) return true;
  return false;
}

/** Watches the document cheaply and wakes page.js the moment it looks like a job page. */
export function startDetector(doc: Document, delay = 800): () => void {
  // Mail, chat, docs, video: never a job page, whatever they render later. No watching at all.
  const url = doc.location?.href ?? '';
  if (url && (isNotJobHost(url) || insideNotJobSite(doc))) return () => {};
  let timer = 0;
  let first = true;
  let idle = 0;
  let lastHref = doc.location.href;
  let woke = false;

  const stop = () => {
    obs.disconnect();
    doc.removeEventListener('visibilitychange', schedule);
    window.clearTimeout(timer);
  };

  const check = () => {
    timer = 0;
    if (woke || doc.hidden) return;
    if ((doc.defaultView as (Window & { __weraPage?: unknown }) | null)?.__weraPage) return stop();
    if (couldBeJobPage(doc)) {
      woke = true;
      void sendSafe({ type: 'wera:wake' });
      stop();
      return;
    }
    idle++;
  };

  const schedule = () => {
    if (woke || !extensionAlive()) return stop();
    if (timer) return;
    if (doc.location.href !== lastHref) {
      lastHref = doc.location.href;
      idle = 0;
    }
    timer = window.setTimeout(check, first ? Math.min(delay, 100) : delay * Math.min(2 ** Math.floor(idle / 3), 16));
    first = false;
  };

  const obs = new MutationObserver(schedule);
  obs.observe(doc, { childList: true, subtree: true });
  doc.addEventListener('visibilitychange', schedule);
  schedule();
  return stop;
}

if (typeof window !== 'undefined' && !window.__weraDetector && typeof chrome !== 'undefined' && chrome.runtime?.id) {
  window.__weraDetector = true;
  startDetector(document);
}
