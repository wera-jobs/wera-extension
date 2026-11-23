// Notices what a person would: a new step of a multi-page application
// (Workday, iCIMS...) appearing without a page load, and the "thank you
// for applying" message after submitting. It tells the side panel; it
// sends no page content.
import type { ContentEvent } from '../shared/types';
import { classify } from './classify';
import { collectFields } from './fields';
import { currentValue, isApplying } from './plan';
import { bodyText, looksSubmitted, shown, submittedAddress } from './submitted';

export { bodyText, looksSubmitted, shown, submittedAddress };

/** The fillable fields now on the page, as a signature that changes when a new step appears. */
export function formSignature(doc: Document): { count: number; key: string; labels: string[] } {
  const labels = collectFields(doc, undefined, true).filter((f) => classify(f) !== null).map((f) => f.label);
  return { count: labels.length, key: labels.join('|'), labels };
}

/** Whether a form is another step, not the same one with a few more fields (a choice revealed them). */
export function isNewStep(before: string[], now: string[]): boolean {
  const known = new Set(before);
  return now.filter((l) => known.has(l)).length < now.length / 2;
}

/** Watches the page; calls notify at most every `delay` ms when something changed. */
export function watchPage(doc: Document, notify: (e: ContentEvent) => void, delay = 700): () => void {
  let last = formSignature(doc);
  let submitted = looksSubmitted(bodyText(doc));
  let href = doc.location.href;
  let timer = 0;
  const check = () => {
    timer = 0;
    // A single-page site moved to another page (another job, the apply step) without loading.
    if (doc.location.href !== href) {
      href = doc.location.href;
      last = formSignature(doc);
      submitted = looksSubmitted(bodyText(doc));
      notify({ type: 'wera:navigated', url: href });
      return;
    }
    const sig = formSignature(doc);
    if (sig.key !== last.key) {
      const step = isNewStep(last.labels, sig.labels);
      last = sig;
      if (sig.count > 0) notify({ type: 'wera:form-changed', fields: sig.count, step });
    }
    if (!submitted && looksSubmitted(bodyText(doc))) {
      submitted = true;
      notify({ type: 'wera:submitted' });
    }
  };
  const schedule = () => {
    if (!timer) timer = window.setTimeout(check, delay);
  };
  const onChange = (e: Event) => {
    if (isApplying()) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const marked = target.closest?.('[data-wera-id]');
    const id = marked?.getAttribute('data-wera-id') ?? '';
    const field = id
      ? collectFields(doc, undefined, true).find((f) => f.id === id)
      : collectFields(doc, undefined, true).find((f) => f.el === target || f.options.some((o) => o.el === target));
    if (!field?.id) return;
    notify({ type: 'wera:field-changed', id: field.id, value: currentValue(field) });
  };
  const obs = new MutationObserver(schedule);
  obs.observe(doc.body, { childList: true, subtree: true });
  doc.addEventListener('change', onChange, true);
  window.addEventListener('popstate', schedule);
  return () => {
    obs.disconnect();
    doc.removeEventListener('change', onChange, true);
    window.removeEventListener('popstate', schedule);
    window.clearTimeout(timer);
  };
}
