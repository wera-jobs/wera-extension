// What the job states at a glance (its pay, when it went up), and a word
// when it may be too late to apply: Wera saw it come down, its job data
// says it expired, or it has been up for months.
import { CalendarDays, CircleDollarSign } from 'lucide-react';
import { ageWords, daysSince, OLD_POSTING_DAYS, payFromText, shortPay } from '../content/facts';
import type { JobDraft } from '../shared/types';
import type { WeraJob } from '../shared/api';
import { Notice } from './ui';

export interface Facts {
  pay: string;
  /** Days since the posting went up; null when nothing says. */
  age: number | null;
  /** Why applying may be too late, in a sentence; empty when nothing says so. */
  warning: string;
}

const earlier = (a?: string | null, b?: string | null) => (a && b ? (Date.parse(a) < Date.parse(b) ? a : b) : (a ?? b ?? null));

/** The facts from Wera's job, the page's job data and the page's text, in that order of trust. */
export function postingFacts(job: WeraJob | null, draft: JobDraft | null | undefined, text: string, now = Date.now()): Facts {
  const pay = shortPay(draft?.salary ?? '') || payFromText(draft?.description || text);
  const age = daysSince(earlier(job?.posted_at ?? draft?.posted, job?.first_seen_at), now);
  const closed = daysSince(job?.closed_at, now);
  const expired = daysSince(draft?.expires, now);
  let warning = '';
  if (closed != null) {
    warning = `Wera last found this job on ${job!.company}'s job board ${ageWords(closed)}. It may no longer take applications.`;
  } else if (expired != null && expired > 0) {
    warning = `This posting stopped taking applications ${ageWords(expired)}, its job data says.`;
  } else if (age != null && age > OLD_POSTING_DAYS) {
    warning = `Posted ${ageWords(age)}. Postings up this long are often filled already, so a reply is less likely.`;
  }
  return { pay, age, warning };
}

export function PostingFacts({ job, draft, text }: { job: WeraJob | null; draft: JobDraft | null | undefined; text: string }) {
  const { pay, age, warning } = postingFacts(job, draft, text);
  if (!pay && age == null && !warning) return null;
  return (
    <div className="space-y-2">
      {(pay || age != null) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 text-xs text-muted" aria-label="About this job">
          {pay && (
            <span className="inline-flex items-center gap-1" title="The pay the posting states">
              <CircleDollarSign className="size-3.5 text-faint" /> {pay}
            </span>
          )}
          {age != null && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5 text-faint" /> Posted {ageWords(age)}
            </span>
          )}
        </div>
      )}
      {warning && <Notice tone="warn">{warning}</Notice>}
    </div>
  );
}
