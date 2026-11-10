// The answers Wera remembers from a page the user finished, for the next
// form: what the user chose or typed in the form's own questions. The page
// script sends them when the user moves the form on (Next, Submit), with
// the details (name, contact, self-identification, see details.ts); the
// panel's Continue does too. It never learns consents or files, and never
// relearns an answer Wera already has.
import { answerKey, type SavedAnswer } from './answers';
import type { FieldPlan, FieldSnapshot } from './types';

const CHOICE = new Set(['select', 'radio', 'checkboxes', 'buttons', 'listbox', 'combobox']);

export interface LearnedAnswer {
  question: string;
  answer: string;
  kind: 'text' | 'long' | 'choice';
  company: string;
}

// A box that labels a box rather than asks anything: its answer means nothing on another form.
const NO_QUESTION = /^(comments?|additional (comments|information|info)|other|please specify|specify|notes?|message|answer|response|details|select( one)?|choose( one)?|optional|n\/?a)$/i;
// An option's text taken for a question ("Yes Required"), or a field of a job or skill row
// ("End date", "Position title"): it belongs to one entry, not to the next form.
const NOT_A_QUESTION = /^(yes|no|opt[- ]?in|opt[- ]?out|i agree|agree|true|false)( required)?$|^(start|end|from|to) date$|^(position|job) title$|^current (position|job|role)$|^(company|employer)( name)?$|^overall$|^skill(set| level)?$|^length of use/i;
// A question whose answer is a number by nature.
const ASKS_NUMBER = /how (many|much|long)|years?|number|percent|%|rate|age|hours|salary|pay|zip|postal/i;

/**
 * Whether an answer to this label can be given again on another form.
 * Not: a label with no words ("594"), one that only labels a box
 * ("Comments"), a label repeated on the page (a row of a skills or
 * languages table: "Skill level" means a different skill each time),
 * a choice's hidden number ("Visible to: 1"), or an option the page
 * shows as a label ("English UK" answered "English UK").
 */
export function worthRemembering(label: string, value: string, kind: LearnedAnswer['kind'], repeated: boolean): boolean {
  const q = label.replace(/\s*\*\s*$/, '').trim();
  const letters = q.replace(/[^\p{L}]/gu, '');
  if (letters.length < 3 || repeated) return false;
  const bare = q.replace(/[:?.]+$/, '').trim();
  if (NO_QUESTION.test(bare) || NOT_A_QUESTION.test(bare)) return false;
  if (kind === 'choice' && /^\d+$/.test(value) && !ASKS_NUMBER.test(q)) return false;
  const plain = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  return plain(value) !== plain(q);
}

/** Answers worth remembering: what the user chose or typed where Wera's details did not decide it. */
export function answersToLearn(plan: Pick<FieldPlan, 'id' | 'label' | 'group'>[], snap: FieldSnapshot[], bank: SavedAnswer[], company: string): LearnedAnswer[] {
  const byId = new Map(plan.map((p) => [p.id, p]));
  const known = new Map(bank.map((a) => [answerKey(a.question), a.answer]));
  const seen = new Map<string, number>();
  for (const p of plan) seen.set(answerKey(p.label), (seen.get(answerKey(p.label)) ?? 0) + 1);
  const out: LearnedAnswer[] = [];
  for (const s of snap) {
    const p = byId.get(s.id);
    if (!p || !p.label.trim() || answerKey(p.label) === '') continue;
    // A detail (name, phone, sponsorship...) belongs in the application details, not here.
    if (p.group !== 'questions' && p.group !== 'other') continue;
    if (s.kind === 'checkbox') continue;
    const value = s.value.trim();
    const kind = s.kind === 'textarea' ? 'long' : CHOICE.has(s.kind) ? 'choice' : 'text';
    if (!value || (kind === 'long' && value.length < 20) || value.length > 6000) continue;
    if (known.get(answerKey(p.label)) === value) continue;
    if (!worthRemembering(p.label, value, kind, (seen.get(answerKey(p.label)) ?? 0) > 1)) continue;
    out.push({ question: p.label.replace(/\s*\*\s*$/, ''), answer: value, kind, company });
  }
  return out;
}
