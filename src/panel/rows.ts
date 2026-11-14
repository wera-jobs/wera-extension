// The panel's view of one form page: a row per field with what Wera will
// enter and how filling went, and the rules for which rows Wera fills,
// asks the AI about, drafts, or leaves to the user. Pure functions, so
// each rule can be tested on its own.
import { SELF_ID } from '../shared/selfId';
import type { FieldPlan, FillStatus, PagePlan } from '../shared/types';

export { LETTER, RESUME } from '../shared/markers';

/** One field as the panel tracks it: the plan, what Wera will enter, and how filling went. */
export interface Row extends FieldPlan {
  /** Filled when Wera fills the page (a value Wera trusts). */
  checked: boolean;
  status?: FillStatus | 'filling';
  result?: string;
  /** Wera drafted this answer (an open question): the user should read it. */
  drafted?: boolean;
  /** Wera entered a choice it inferred (see mayChoose): the user should check it. */
  chosen?: boolean;
  /** What to ask the AI, when the label alone is not the whole question (see followUpOf). */
  asked?: string;
}

/** The rows for a plan: values Wera trusts are filled; what the page already shows is left. */
export function rowsFor(plan: PagePlan, sources: Record<string, string> = {}): Row[] {
  return plan.fields.map((f) => ({
    ...f,
    source: f.source === 'details' && f.purpose && sources[f.purpose] ? (sources[f.purpose] === 'resume' ? 'resume' : 'profile') : f.source,
    checked: f.value !== '' && f.group !== 'consent' && f.current === '',
    status: f.current !== '' && f.current === f.value ? 'already' : undefined,
  }));
}

/** Questions the AI never answers: self-identification, and what only the user knows (who referred them). */
const NOT_FOR_AI = new Set(['referral', ...SELF_ID]);

/** Fields worth asking the AI about: empty, not answered by anything Wera knows, and not the user's to answer. */
export function needsSuggestion(r: Row): boolean {
  return !r.trap && r.label.trim() !== '' && r.value === '' && r.current === '' && r.entry == null && !(r.purpose && NOT_FOR_AI.has(r.purpose))
    && (r.group === 'details' || r.group === 'other' || (r.group === 'questions' && r.kind !== 'textarea'))
    && r.kind !== 'file' && r.kind !== 'checkbox';
}

/** A box for anything else ("Additional information"), not a question: left empty unless the form insists. */
const CATCH_ALL = /^(additional|other|further) (information|info|comments|details|notes)\b|^anything else\b|^comments?$|^notes?$/i;

/** Open questions Wera drafts an answer for: an empty text area asking something (not the cover letter). */
export function needsDraft(r: Row): boolean {
  return !r.trap && !r.ownWords && r.group === 'questions' && r.kind === 'textarea' && r.purpose === 'question' && r.value === '' && r.current === ''
    && r.label.trim().length >= 8 && (r.required || !CATCH_ALL.test(r.label.trim()));
}

/**
 * A cover letter box or upload Wera has nothing for yet (no letter for
 * this job) that is worth writing one for: the form insists, or asks for a
 * cover letter by name (not Lever's "Additional information").
 */
export function needsLetter(r: Row): boolean {
  return r.purpose === 'cover_letter' && (r.kind === 'file' || r.kind === 'textarea') && r.value === '' && r.current === ''
    && (r.required || /cover\s*letter|motivation(al)?\s*letter|letter of (motivation|interest)/i.test(r.label));
}

// "If yes, please explain", "If no, why not?", "If other, please specify":
// asked only on one answer to the question before.
const FOLLOW_UP = /^\s*if\s+(?:you\s+(?:answered|selected|said|chose|responded)\s+)?["'“‘]?(yes|no|other)\b/i;

export const isFollowUp = (r: Pick<Row, 'label'>) => FOLLOW_UP.test(r.label);

/** What a field holds now, in the page or on its way there. */
function answerOf(r: Row): string {
  if (r.status === 'filled' || r.status === 'already') return r.result ?? r.value;
  return r.current;
}

export interface FollowUp {
  /** The question it follows. */
  question: Row;
  said: string;
  /** Whether it applies; null until the question has an answer it can tell from. */
  applies: boolean | null;
}

/** The row at i as a follow-up to the question before it. rows are in page order. */
export function followUpOf(rows: Row[], i: number): FollowUp | null {
  const when = FOLLOW_UP.exec(rows[i]!.label)?.[1]?.toLowerCase();
  if (!when) return null;
  let at = i - 1;
  while (at >= 0 && isFollowUp(rows[at]!)) at--;
  const question = rows[at];
  if (!question) return null;
  const said = answerOf(question).trim();
  const text = said.toLowerCase();
  if (when === 'other') return { question, said, applies: said ? text.includes('other') : null };
  const yes = /^yes\b/.test(text);
  const no = /^no\b/.test(text);
  return { question, said, applies: yes || no ? (when === 'yes' ? yes : no) : null };
}

const CHOICE = new Set(['select', 'radio', 'listbox', 'combobox', 'buttons']);
const YES_NO = /^\s*(yes|no|y|n|true|false)\b/i;
const REFUSAL = /^\s*(none|not |never|n\/?a\b|i (do not|don't|am not|have not|haven't)|decline|prefer not|other\b)/i;

/**
 * An answer the AI inferred that Wera may enter all the same, marked for
 * the user to check: one of three or more listed choices ("How did you
 * hear about us?", "Years of experience: 3-5"). Never a yes or no: a wrong
 * yes claims what is not so, and a wrong no can end the application, so
 * those stay one click away. Never a refusal or "Other", and never on a
 * required consent, a trap or a question the AI should not answer.
 */
export function mayChoose(r: Pick<Row, 'kind' | 'options' | 'trap' | 'group'>, value: string): boolean {
  if (r.trap || r.group === 'consent' || r.group === 'self_id' || !CHOICE.has(r.kind)) return false;
  if (r.options.length < 3 || !r.options.includes(value)) return false;
  if (YES_NO.test(value) || REFUSAL.test(value)) return false;
  // A yes/no question with a third way out ("Yes", "No", "Prefer not to say") is still a yes or no.
  return r.options.filter((o) => YES_NO.test(o)).length < 2;
}

/** An AI answer Wera did not trust enough to enter by itself. */
export const isGuess = (r: Row) => r.source === 'ai' && !!r.value && !r.checked && r.status !== 'filled';

/**
 * What still needs the user once Wera is done: required fields left
 * empty or that did not take, self-identification not in their profile,
 * consents, AI guesses to confirm, and answers Wera drafted.
 */
export function needsYou(rows: Row[]): Row[] {
  return rows.filter((r) => {
    if (r.status === 'filled' && (r.drafted || r.chosen)) return true;
    if (r.status === 'filled' || r.status === 'already') return false;
    if (r.status === 'review') return true;
    if (isGuess(r)) return true;
    return r.group === 'consent' || r.group === 'self_id' || (r.required && r.current === '');
  });
}

/** Whether an AI answer can be what the field asks for: a LinkedIn box takes a LinkedIn address, not any link from the resume. */
export function fitsPurpose(purpose: FieldPlan['purpose'], value: string): boolean {
  switch (purpose) {
    case 'linkedin':
      return /linkedin\.com\//i.test(value);
    case 'github':
      return /github\.com\//i.test(value);
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    case 'phone':
      return (value.match(/\d/g) ?? []).length >= 7;
    default:
      return true;
  }
}

/**
 * Whether an AI answer reads as an answer to the field: a bare number is
 * none to an open question, and is what a trap that got through would ask
 * for ("fill 0 instead of your answer").
 */
export function readsLikeAnswer(r: Pick<FieldPlan, 'kind' | 'purpose'>, value: string): boolean {
  return !(r.kind === 'textarea' && r.purpose === 'question' && /^[\d\s.,-]*$/.test(value));
}

/** A row's name: a job's or school's field says which ("Job 2 · Month"). */
export function rowLabel(r: Row): string {
  const label = (r.label || 'Field').replace(/\s*\*\s*$/, '');
  if (r.entry == null || !r.purpose) return label;
  return `${r.purpose.startsWith('exp_') ? 'Job' : 'School'} ${r.entry + 1} · ${label}`;
}

/** Runs fn over items, at most n at a time. */
export async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    for (let it = queue.shift(); it !== undefined; it = queue.shift()) await fn(it);
  }));
}

export const chunk = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));
