// "My details": every detail Wera keeps for applications, one tap to copy,
// for the forms (and fields) Wera can't fill.
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, Search, Trash2 } from 'lucide-react';
import type { SavedAnswer } from '../shared/answers';
import type { ApplicantView, WeraApi } from '../shared/api';
import type { Applicant, ApplicantKey } from '../shared/types';
import { describeError } from '../shared/errors';
import { Notice } from './ui';

// The details in the order a form asks for them, with the label people know.
const GROUPS: [string, [ApplicantKey, string][]][] = [
  ['Name', [['first_name', 'First name'], ['middle_name', 'Middle name'], ['last_name', 'Last name'], ['preferred_name', 'Preferred name'], ['pronouns', 'Pronouns']]],
  ['Contact', [['email', 'Email'], ['phone', 'Phone']]],
  ['Address', [['address', 'Street address'], ['address_line2', 'Address line 2'], ['city', 'City'], ['state', 'State or region'], ['postal_code', 'Postal code'], ['country', 'Country']]],
  ['Links', [['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['portfolio', 'Portfolio or website'], ['twitter', 'X / Twitter'], ['other_link', 'Other link']]],
  ['Work', [['current_title', 'Current title'], ['current_company', 'Current company'], ['years_experience', 'Years of experience']]],
  ['Education', [['school', 'School'], ['degree', 'Degree'], ['major', 'Major'], ['graduation_year', 'Graduation year'], ['gpa', 'GPA']]],
  ['Work rights', [['authorized_to_work', 'Authorized to work'], ['needs_sponsorship', 'Needs sponsorship'], ['citizenship', 'Citizenship'], ['visa_status', 'Visa status'], ['security_clearance', 'Security clearance']]],
  ['Answers', [['salary_expectation', 'Salary expectation'], ['start_date', 'Start date'], ['notice_period', 'Notice period'], ['willing_to_relocate', 'Willing to relocate'], ['willing_to_travel', 'Willing to travel'], ['work_preference', 'Work preference'], ['languages', 'Languages'], ['how_heard', 'How you heard']]],
];

const period = (start?: string, end?: string, current?: boolean) => [start, current ? 'present' : end].filter(Boolean).join(' to ');

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      window.setTimeout(() => setDone(false), 1200);
    } catch {
      // Clipboard refused (an insecure page): the value is on screen to select.
    }
  };
  return (
    <button type="button" onClick={() => void copy()} aria-label={`Copy ${label}: ${value}`}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2">
      <span className="w-28 shrink-0 text-[11px] text-muted">{label}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-text">{value}</span>
      {done ? <Check className="size-3.5 shrink-0 text-good" /> : <Copy className="size-3.5 shrink-0 text-faint" />}
    </button>
  );
}

export function DetailsView({ api, onClose }: { api: WeraApi; onClose: () => void }) {
  const [me, setMe] = useState<ApplicantView | null>(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<SavedAnswer[]>([]);
  const [find, setFind] = useState('');
  useEffect(() => {
    api.applicant().then(setMe, (e: unknown) => setError(describeError(e, "Couldn't load your details")));
    api.answers().then(setAnswers, () => {});
  }, [api]);
  const q = find.trim().toLowerCase();
  const shownAnswers = answers.filter((x) => !q || `${x.question} ${x.answer} ${x.company}`.toLowerCase().includes(q)).slice(0, q ? 50 : 15);
  const forget = (x: SavedAnswer) => {
    if (x.id == null) return;
    setAnswers((list) => list.filter((y) => y !== x));
    api.deleteAnswer(x.id).catch((e: unknown) => {
      setAnswers((list) => [x, ...list]);
      setError(describeError(e, "Couldn't forget that answer"));
    });
  };
  const a: Partial<Applicant> = me?.applicant ?? {};
  const value = (k: ApplicantKey) => String(a[k] ?? '').trim();
  const filled = GROUPS.map(([g, keys]) => [g, keys.filter(([k]) => value(k))] as const).filter(([, keys]) => keys.length);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} aria-label="Back" className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text">
          <ArrowLeft className="size-4" />
        </button>
        <h2 className="text-sm font-semibold text-text">My details</h2>
      </div>
      <p className="text-xs text-muted">Tap a detail to copy it, for the fields Wera can't fill.</p>
      {error && <Notice tone="bad">{error}</Notice>}
      {!me && !error && <div className="skeleton h-40 w-full" />}
      {me && filled.length === 0 && (
        <Notice tone="warn">
          You haven't added your details yet.{' '}
          <a href={api.dashboardUrl('/profile#application')} target="_blank" rel="noreferrer" className="font-medium underline">Add them in Wera</a>
        </Notice>
      )}
      {filled.map(([group, keys]) => (
        <section key={group} aria-label={group}>
          <h3 className="px-2 pb-0.5 text-[10px] font-semibold tracking-wide text-faint uppercase">{group}</h3>
          {keys.map(([k, label]) => <CopyRow key={k} label={label} value={value(k)} />)}
        </section>
      ))}
      {!!me?.experience.length && (
        <section aria-label="Past jobs">
          <h3 className="px-2 pb-0.5 text-[10px] font-semibold tracking-wide text-faint uppercase">Past jobs</h3>
          {me.experience.map((x, i) => (
            <div key={i} className="border-t border-border/60 pt-1 first:border-0 first:pt-0">
              <CopyRow label="Title" value={x.title} />
              <CopyRow label="Company" value={x.company} />
              {period(x.start, x.end, x.current) && <CopyRow label="Dates" value={period(x.start, x.end, x.current)} />}
              {x.description && <CopyRow label="Description" value={x.description} />}
            </div>
          ))}
        </section>
      )}
      {!!me?.skills.length && (
        <section aria-label="Skills">
          <h3 className="px-2 pb-0.5 text-[10px] font-semibold tracking-wide text-faint uppercase">Skills</h3>
          <CopyRow label="All skills" value={me.skills.join(', ')} />
        </section>
      )}
      {answers.length > 0 && (
        <section aria-label="Saved answers" className="space-y-1">
          <h3 className="px-2 pb-0.5 text-[10px] font-semibold tracking-wide text-faint uppercase">Saved answers ({answers.length})</h3>
          <label className="mx-2 flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2 py-1">
            <Search className="size-3.5 text-faint" />
            <input aria-label="Search saved answers" placeholder="Search your answers" value={find} onChange={(e) => setFind(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-xs text-text outline-none" />
          </label>
          {shownAnswers.map((x, i) => (
            <div key={x.id ?? i} className="flex items-start gap-1">
              <div className="min-w-0 flex-1"><CopyRow label={x.question.slice(0, 60)} value={x.answer} /></div>
              {x.id != null && (
                <button type="button" aria-label={`Forget the answer to ${x.question}`} onClick={() => forget(x)} className="mt-1.5 grid size-6 shrink-0 place-items-center rounded text-faint hover:text-bad">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          {q && !shownAnswers.length && <p className="px-2 text-[11px] text-faint">No saved answer matches.</p>}
        </section>
      )}
      {!!me?.education.length && (
        <section aria-label="Schools">
          <h3 className="px-2 pb-0.5 text-[10px] font-semibold tracking-wide text-faint uppercase">Schools</h3>
          {me.education.map((x, i) => (
            <div key={i} className="border-t border-border/60 pt-1 first:border-0 first:pt-0">
              <CopyRow label="School" value={x.school} />
              {x.degree && <CopyRow label="Degree" value={x.degree} />}
              {x.major && <CopyRow label="Major" value={x.major} />}
              {period(x.start, x.end) && <CopyRow label="Dates" value={period(x.start, x.end)} />}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
