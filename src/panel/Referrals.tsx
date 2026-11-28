// A referral is the surest way past the pile, so the panel points to the
// people most likely to give one: those at the company who share a school
// or an employer with the user, its recruiters, and those in the role. They
// are LinkedIn searches the user opens (Wera reads nothing from LinkedIn),
// with a short note to send, drafted from the user's profile.
import { useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Check, ChevronDown, Copy, ExternalLink, Plus, Sparkles, UserRound, Users } from 'lucide-react';
import type { ApplicantView, JobContact, WeraApi } from '../shared/api';
import { describeError } from '../shared/errors';
import { log } from '../shared/log';
import { Button, Notice } from './ui';

export interface ReferralSearch {
  label: string;
  url: string;
}

const people = (words: string) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(words)}&origin=GLOBAL_SEARCH_HEADER`;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The role a title names, without its team, level notes and company:
 * "Account Executive - Commercial, Spotify Technology" is "Account
 * Executive", "Senior SRE (Platform)" is "Senior SRE".
 */
export function roleOf(title: string, company: string): string {
  let t = title.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').split(/\s+[-–—|]\s+|,\s*|\s+\/\s+/)[0] ?? '';
  if (company) t = t.replace(new RegExp(`\\b${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '');
  t = t.replace(/\s+/g, ' ').trim();
  return t.split(' ').length <= 6 ? t : '';
}

/**
 * LinkedIn searches for people at the company who could refer the user:
 * schoolmates first (alumni answer strangers most), then former colleagues,
 * then recruiters and people in the role. At most six.
 */
export function referralSearches(company: string, title: string, me: Pick<ApplicantView, 'education' | 'experience'> | null): ReferralSearch[] {
  if (!company.trim()) return [];
  const out: ReferralSearch[] = [];
  const schools = [...new Set((me?.education ?? []).map((e) => e.school.trim()).filter(Boolean))].slice(0, 2);
  for (const s of schools) out.push({ label: `${s} alumni at ${company}`, url: people(`${company} ${s}`) });
  const employers = [...new Set((me?.experience ?? []).map((e) => e.company.trim()).filter((c) => c && !same(c, company)))].slice(0, 2);
  for (const c of employers) out.push({ label: `Former ${c} people at ${company}`, url: people(`${company} ${c}`) });
  out.push({ label: `Recruiters at ${company}`, url: people(`${company} recruiter`) });
  const role = roleOf(title, company);
  if (role) out.push({ label: `${role} people at ${company}`, url: people(`${company} ${role}`) });
  return out.slice(0, 6);
}

/** What Wera asks the AI for: a note short enough for a LinkedIn connection request. */
export function referralQuestion(company: string, title: string): string {
  return `Write a LinkedIn connection note, under 300 characters, from me to someone who works at ${company}, `
    + `asking if they would be open to referring me for the ${title} role. Be warm and direct, name one specific strength of mine `
    + 'that fits the role, and leave a [Name] placeholder for their name. Do not invent anything we share.';
}

export function Referrals({ api, jobId, company, title, description }: {
  api: WeraApi; jobId: number | null; company: string; title: string; description: string;
}) {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<ApplicantView | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [contacts, setContacts] = useState<JobContact[] | null>(null);
  const [adding, setAdding] = useState(false);
  if (!company) return null;

  const toggle = () => {
    setOpen((v) => !v);
    if (!me) api.applicant().then(setMe, (e: unknown) => log.warn('referrals', 'loading your schools and employers failed', e));
    if (jobId != null && contacts == null) api.jobContacts(jobId).then(setContacts, (e: unknown) => log.warn('referrals', 'loading this job\'s contacts failed', e));
  };
  const draft = async () => {
    setBusy(true);
    setError('');
    try {
      const a = await api.answer(referralQuestion(company, title), jobId, 60, { company, title, description });
      if (a.answer) setNote(a.answer.trim());
      else setError(a.needs_input || 'Wera could not write a note this time. Try again.');
    } catch (e) {
      setError(describeError(e, "Couldn't write a note"));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      log.warn('referrals', 'copying the note failed', e);
    }
  };

  const searches = referralSearches(company, title, me);
  return (
    <div className="rounded-card border border-border bg-surface text-xs">
      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left" aria-expanded={open} onClick={toggle}>
        <Users className="size-3.5 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 font-medium">Find someone to refer you</span>
        <ChevronDown className={clsx('size-3 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-3 py-2">
          <p className="text-muted">A referral moves an application to the top of the pile. Start with people you share something with.</p>
          <ul className="space-y-1">
            {searches.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  {s.label} <ExternalLink className="size-3" />
                </a>
              </li>
            ))}
          </ul>
          {note ? (
            <div className="space-y-1.5">
              <textarea aria-label="Your note" value={note} onChange={(e) => setNote(e.target.value)} rows={5}
                className="w-full resize-y rounded-lg border border-border bg-surface-2 p-2 text-xs text-text" />
              <div className="flex items-center gap-2">
                <Button className="px-2 py-1" onClick={() => void copy()}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? 'Copied' : 'Copy'}</Button>
                <span className={clsx('text-[11px]', note.length > 300 ? 'text-warn' : 'text-faint')}>{note.length}/300</span>
                <button type="button" className="ml-auto text-[11px] text-faint hover:text-text" disabled={busy} onClick={() => void draft()}>Again</button>
              </div>
            </div>
          ) : (
            <Button className="px-2 py-1" busy={busy} onClick={() => void draft()}>{!busy && <Sparkles className="size-3.5" />} Write a note to send</Button>
          )}
          {error && <Notice tone="bad">{error}</Notice>}
          {jobId != null && (
            <div className="space-y-1.5 border-t border-border pt-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">People for this job</span>
                {!adding && <button type="button" className="ml-auto inline-flex items-center gap-1 text-[11px] text-accent hover:underline" onClick={() => setAdding(true)}><Plus className="size-3" /> Save a contact</button>}
              </div>
              {contacts?.length ? (
                <ul className="space-y-1">
                  {contacts.map((c) => (
                    <li key={c.id} className="flex items-center gap-1.5">
                      <UserRound className="size-3 shrink-0 text-muted" />
                      {c.linkedin_url ? <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{c.name}</a> : <span>{c.name}</span>}
                      {c.role && <span className="truncate text-faint">{c.role}</span>}
                      {c.follow_up_at && <span className="ml-auto shrink-0 text-[11px] text-faint">follow up {c.follow_up_at.slice(0, 10)}</span>}
                    </li>
                  ))}
                </ul>
              ) : !adding && <p className="text-faint">None saved yet. Save whoever you message, and Wera reminds you to follow up.</p>}
              {adding && <ContactForm onCancel={() => setAdding(false)} onSave={async (c) => {
                const saved = await api.addContact(jobId, c);
                setContacts((list) => [...(list ?? []), saved]);
                setAdding(false);
              }} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ContactForm({ onSave, onCancel }: { onSave: (c: { name: string; role?: string; linkedin_url?: string; follow_up_at?: string }) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [url, setUrl] = useState('');
  const [follow, setFollow] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const box = 'w-full rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs text-text';
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({ name: name.trim(), role: role.trim() || undefined, linkedin_url: url.trim() || undefined, follow_up_at: follow ? new Date(`${follow}T09:00:00`).toISOString() : undefined });
    } catch (err) {
      setError(describeError(err, "Couldn't save the contact"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-1.5">
      <input aria-label="Name" placeholder="Name" required value={name} onChange={(e) => setName(e.target.value)} className={box} />
      <input aria-label="Role" placeholder="Role (Recruiter, Engineer...)" value={role} onChange={(e) => setRole(e.target.value)} className={box} />
      <input aria-label="LinkedIn profile" placeholder="LinkedIn profile URL" type="url" value={url} onChange={(e) => setUrl(e.target.value)} className={box} />
      <label className="flex items-center gap-2 text-[11px] text-muted">Follow up on <input aria-label="Follow up on" type="date" value={follow} onChange={(e) => setFollow(e.target.value)} className={clsx(box, 'w-auto')} /></label>
      {error && <Notice tone="bad">{error}</Notice>}
      <div className="flex gap-2">
        <Button type="submit" className="px-2 py-1" busy={busy}>Save</Button>
        <button type="button" className="text-[11px] text-muted hover:text-text" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
