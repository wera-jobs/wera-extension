// "My details": every detail Wera keeps for applications, one tap to copy,
// for the forms (and fields) Wera can't fill.
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, Search, Trash2 } from 'lucide-react';
import type { SavedAnswer } from '../shared/answers';
import { VETERAN_NO, VETERAN_PROTECTED, VETERAN_UNPROTECTED, veteranStatus } from '../shared/selfId';
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
  ['Equal employment', [['gender', 'Gender'], ['race', 'Race'], ['hispanic', 'Hispanic or Latino'], ['veteran', 'Veteran status'], ['disability', 'Disability']]],
];

const YES_NO: [string, string][] = [['', 'Not set'], ['yes', 'Yes'], ['no', 'No']];
const DECLINE: [string, string] = ['decline', 'Prefer not to say'];
// Choices where a form's wording must be matched by meaning: the same values the dashboard stores.
const CHOICES: Partial<Record<ApplicantKey, [string, string][]>> = {
  authorized_to_work: YES_NO, needs_sponsorship: YES_NO, willing_to_relocate: YES_NO, willing_to_travel: YES_NO,
  work_preference: [['', 'Not set'], ['remote', 'Remote'], ['hybrid', 'Hybrid'], ['onsite', 'On-site'], ['any', 'Any']],
  gender: [['', 'Not set'], ['Male', 'Male'], ['Female', 'Female'], ['Non-binary', 'Non-binary'], DECLINE],
  race: [['', 'Not set'], ['American Indian or Alaska Native', 'American Indian or Alaska Native'], ['Asian', 'Asian'], ['Black or African American', 'Black or African American'],
    ['Native Hawaiian or Other Pacific Islander', 'Native Hawaiian or Other Pacific Islander'], ['White', 'White'], ['Two or more races', 'Two or more races'], DECLINE],
  hispanic: [...YES_NO, DECLINE],
  veteran: [['', 'Not set'], [VETERAN_NO, 'Not a veteran'], [VETERAN_UNPROTECTED, 'Veteran, not protected'], [VETERAN_PROTECTED, 'Protected veteran'], DECLINE],
  disability: [['', 'Not set'], ['No, I do not have a disability', 'No'], ['Yes, I have a disability', 'Yes'], DECLINE],
};

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
  const value = (k: ApplicantKey) => (k === 'veteran' ? veteranStatus(String(a[k] ?? '')) : String(a[k] ?? '').trim());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Applicant>>({});
  const [saving, setSaving] = useState(false);
  const shownValue = (k: ApplicantKey) => {
    const v = value(k);
    return CHOICES[k]?.find(([c]) => c === v)?.[1] ?? v;
  };
  const filled = (editing ? GROUPS : GROUPS.map(([g, keys]) => [g, keys.filter(([k]) => value(k))] as const)).filter(([, keys]) => keys.length);
  const save = async () => {
    if (!me) return;
    setSaving(true);
    setError('');
    try {
      const r = await api.saveApplicant({ ...(me.applicant), ...draft });
      setMe({ ...me, applicant: r.applicant });
      setEditing(false);
      setDraft({});
    } catch (e) {
      setError(describeError(e, "Couldn't save your details"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} aria-label="Back" className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text">
          <ArrowLeft className="size-4" />
        </button>
        <h2 className="text-sm font-semibold text-text">My details</h2>
        {me && (editing ? (
          <span className="ml-auto flex items-center gap-2">
            <button type="button" className="text-[11px] text-muted hover:text-text" onClick={() => { setEditing(false); setDraft({}); }}>Cancel</button>
            <button type="button" disabled={saving} className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-bg disabled:opacity-60" onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</button>
          </span>
        ) : (
          <button type="button" className="ml-auto text-[11px] font-medium text-accent hover:underline" onClick={() => setEditing(true)}>Edit</button>
        ))}
      </div>
      <p className="text-xs text-muted">{editing ? 'Change what Wera fills on applications. Saved to your Wera profile.' : "Tap a detail to copy it, for the fields Wera can't fill."}</p>
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
          {keys.map(([k, label]) => editing
            ? <EditRow key={k} label={label} value={String(draft[k] ?? value(k))} choices={CHOICES[k]} onChange={(v) => setDraft((d) => ({ ...d, [k]: v }))} />
            : <CopyRow key={k} label={label} value={shownValue(k)} />)}
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

function EditRow({ label, value, choices, onChange }: { label: string; value: string; choices?: [string, string][]; onChange: (v: string) => void }) {
  const box = 'min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-text focus:border-accent/60 focus:outline-none';
  return (
    <label className="flex items-center gap-2 px-2 py-1">
      <span className="w-28 shrink-0 text-[11px] text-muted">{label}</span>
      {choices ? (
        <select aria-label={label} value={choices.some(([c]) => c === value) ? value : ''} onChange={(e) => onChange(e.target.value)} className={box}>
          {choices.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
        </select>
      ) : (
        <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={box} />
      )}
    </label>
  );
}
