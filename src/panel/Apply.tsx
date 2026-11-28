// An application in the Wera panel: one Autofill button, then only what
// still needs the user (with why), Continue on multi-page forms, the
// resume and cover letter Wera uses, and what it filled.
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronDown, Copy, FileText, Flag, PenLine, RefreshCw, Sparkles, Square, Zap } from 'lucide-react';
import type { LetterSteer, WeraApi } from '../shared/api';
import { PAST_APPLIED } from '../shared/jobs';
import { frames } from '../shared/rpc';
import { diagnostics, reportPage, REPORT_DETAILS_MAX } from './diagnostics';
import { describeError } from '../shared/errors';
import type { PanelProps } from './Panel';
import { isGuess, rowLabel } from './rows';
import { BigButton, Button, Notice } from './ui';
import { LETTER, RESUME, needsYou, useAutofill, type Row } from './useAutofill';
import type { PanelPageState } from './usePanelPage';
import { Traps } from './Traps';
import { TailoredLine, useTailoredScore } from './Tailored';

/** An application: Autofill, then what still needs the user, then Continue on multi-page forms. */
export function Apply({ api, page, settings, tabId, fillRequest }: PanelProps & { api: WeraApi }) {
  const a = useAutofill(api, page, settings, tabId);
  const [showFilled, setShowFilled] = useState(false);
  const [reporting, setReporting] = useState(false);

  // The toolbar shortcut or right-click menu asked to fill.
  const [handled, setHandled] = useState(0);
  useEffect(() => {
    if (fillRequest > handled && !page.loading && !a.busy) {
      // A request from outside React (a message from the background).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHandled(fillRequest);
      void a.autofill();
    }
  }, [fillRequest, handled, page.loading, a]);

  // The job card shows the system and step the fill read.
  const { noteForm } = page;
  useEffect(() => {
    if (a.plan) noteForm(a.plan.site, a.plan.step);
  }, [a.plan, noteForm]);

  const needs = useMemo(() => needsYou(a.rows), [a.rows]);
  const guesses = needs.filter((r) => isGuess(r) && !r.confirm).length;
  const filled = a.rows.filter((r) => r.status === 'filled' || r.status === 'already');
  const total = a.rows.length;
  const done = a.phase === 'filled' || a.phase === 'final';
  const label = a.phase === 'reading' ? 'Reading the form…' : a.phase === 'filling' ? `Filling… ${filled.length}/${total}`
    : a.phase === 'thinking' ? `Answering ${a.thinking} question${a.thinking === 1 ? '' : 's'}…` : a.phase === 'stopping' ? 'Stopping…' : a.phase === 'continuing' ? 'Moving to the next page…'
    : done ? 'Fill again' : 'Autofill';

  return (
    <div className="space-y-3">
      {page.newStep > 0 && a.phase !== 'continuing' && a.plan && (
        <Notice tone="warn">
          <div className="flex items-center gap-2">
            <span className="flex-1">A new step appeared with {page.newStep} field{page.newStep === 1 ? '' : 's'}.</span>
            <Button variant="primary" onClick={() => void a.autofill()} busy={a.busy}>Fill it</Button>
          </div>
        </Notice>
      )}
      {(a.plan?.gate ?? page.info?.gate) && <Notice tone="warn">{a.plan?.gate ?? page.info?.gate}</Notice>}
      {page.job?.application_status && PAST_APPLIED.has(page.job.application_status) && !page.submitted && (
        <Notice tone="warn">Your tracker says you already applied to this job.</Notice>
      )}
      <div className="flex gap-2">
        <BigButton className="min-w-0 flex-1" onClick={() => void a.autofill()} busy={a.busy} title="Alt+Shift+F">
          {!a.busy && <Zap className="size-4" />} <span className="truncate">{label}</span>
        </BigButton>
        {a.stoppable && (
          <button type="button" onClick={a.stop} title="Stop filling. What is already filled stays."
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text hover:border-bad/50 hover:text-bad">
            <Square className="size-3 fill-current" /> Stop
          </button>
        )}
      </div>
      {total > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-good transition-all duration-300" style={{ width: `${(100 * filled.length) / total}%` }} />
          </span>
          <span className="font-mono">{filled.length}/{total}</span>
        </div>
      )}
      {a.phase === 'idle' && !a.plan && (
        <p className="text-center text-[11px] text-faint">Fills your details, attaches your resume and drafts the open questions. You review and submit.</p>
      )}
      {a.error && <Notice tone="bad">{a.error}</Notice>}
      {a.warnings.length > 0 && (
        <Notice tone="warn">
          <ul className="space-y-1">{a.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Notice>
      )}
      {a.notice && <Notice tone="good">{a.notice}</Notice>}
      <Traps traps={[...(page.info?.traps ?? []), ...(a.plan?.traps ?? [])]} onDraftAnyway={a.noAiHere && done ? () => void a.draftDespitePolicy() : undefined} />

      {done && needs.length > 0 && (
        <div className="anim-rise space-y-1.5">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase"><AlertTriangle className="size-3.5 text-warn" /> Needs you ({needs.length})</h3>
          <ul className="space-y-1.5">{needs.map((r) => <NeedRow key={r.id} r={r} onUse={(v) => void a.fillOne(r, v)} />)}</ul>
          {guesses > 1 && <Button className="w-full" busy={a.busy} onClick={() => void a.acceptGuesses()}>Use all {guesses} guesses</Button>}
        </div>
      )}
      {done && needs.length === 0 && total > 0 && (
        <Notice tone="good"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5" /> Everything Wera can see is filled. Check the page, then {a.phase === 'final' ? 'submit it yourself' : 'continue'}.</span></Notice>
      )}
      {a.phase === 'filled' && a.plan?.next && !a.plan.next.final && (
        <Button variant="primary" className="w-full py-2.5" onClick={() => void a.continueOn()} busy={a.busy}>
          Continue to the next page <ArrowRight className="size-3.5" />
        </Button>
      )}
      {a.phase === 'final' && a.plan?.next?.final && (
        <p className="text-[11px] text-muted">Last page: check everything, then press <b className="text-text">{a.plan.next.label}</b> on the site yourself.</p>
      )}

      {a.corrections.length > 0 && (
        <div className="anim-rise space-y-1.5">
          {a.corrections.map((c) => (
            <div key={c.key} className="rounded-lg border border-accent/30 bg-surface px-2.5 py-2 text-xs">
              <p className="text-text">You changed <span className="font-medium">{c.label}</span> to <span className="font-medium">"{c.to}"</span>. Update your Wera details?</p>
              <div className="mt-1.5 flex justify-end gap-1.5">
                <Button variant="ghost" className="px-2 py-1" onClick={() => a.dismissCorrection(c.key)}>Dismiss</Button>
                <Button variant="primary" className="px-2.5 py-1" onClick={() => void a.acceptCorrection(c)}>Update</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Docs api={api} page={page} a={a} />

      {filled.length > 0 && (
        <div>
          <button type="button" className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-text" onClick={() => setShowFilled((v) => !v)}>
            <ChevronDown className={clsx('size-3 transition-transform', showFilled && 'rotate-180')} /> What Wera filled ({filled.length})
          </button>
          {showFilled && (
            <ul className="mt-1.5 space-y-1">
              {filled.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => void frames('highlight', r.id)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[11px] hover:bg-surface-2">
                    <CheckCircle2 className={clsx('size-3 shrink-0', r.status === 'filled' ? 'text-good' : 'text-faint')} />
                    <span className="min-w-0 flex-1 truncate text-muted">{rowLabel(r)}</span>
                    <span className="max-w-[45%] truncate text-text">{r.value === RESUME ? 'resume' : r.value === LETTER ? 'cover letter' : r.result || r.value}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <a href={api.dashboardUrl('/profile#application')} target="_blank" rel="noreferrer" className="text-[11px] text-faint hover:text-text hover:underline">
          Your details and saved answers
        </a>
        {a.plan && !reporting && (
          <button type="button" onClick={() => setReporting(true)} className="ml-auto inline-flex items-center gap-1 text-[11px] text-faint hover:text-text">
            <Flag className="size-3" /> Report a problem
          </button>
        )}
      </div>
      {a.plan && reporting && <ReportProblem api={api} a={a} onClose={() => setReporting(false)} />}
    </div>
  );
}

/**
 * "Report a problem": what went wrong in the person's words, sent to the
 * Wera team with what Wera read on this page and what happened (see
 * diagnostics.ts; self-identification answers are left out).
 */
export function ReportProblem({ api, a, onClose }: { api: WeraApi; a: Parameters<typeof diagnostics>[0]; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [state, setState] = useState<'' | 'sending' | 'sent'>('');
  const [error, setError] = useState('');
  const send = async () => {
    setState('sending');
    setError('');
    try {
      const details = (await diagnostics(a)).slice(0, REPORT_DETAILS_MAX);
      await api.reportProblem({ note: note.trim(), page: reportPage(), version: chrome.runtime.getManifest?.().version ?? '', details });
      setState('sent');
    } catch (e) {
      setState('');
      setError(describeError(e, "Couldn't send the report"));
    }
  };
  if (state === 'sent') {
    return (
      <div className="anim-rise flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted" role="status">
        <CheckCircle2 className="size-3.5 shrink-0 text-good" />
        <span className="flex-1">Sent. Thank you, we'll look into it.</span>
        <button type="button" className="text-[11px] text-faint hover:text-text" onClick={onClose}>Close</button>
      </div>
    );
  }
  return (
    <div className="anim-rise space-y-2 rounded-lg border border-border bg-surface p-3">
      <textarea aria-label="What went wrong?" placeholder="What went wrong? For example: the phone box was left empty." value={note}
        onChange={(e) => setNote(e.target.value)} rows={3} maxLength={4000} autoFocus
        className="w-full resize-y rounded-lg border border-border bg-surface-2 p-2 text-xs text-text placeholder:text-faint focus:border-accent/60 focus:outline-none" />
      <p className="text-[11px] text-faint">Sends your note and what Wera read on this page to the Wera team. Self-identification answers are left out.</p>
      {error && <Notice tone="bad">{error}</Notice>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" className="px-2 py-1" onClick={onClose}>Cancel</Button>
        <Button variant="primary" className="px-2.5 py-1" busy={state === 'sending'} disabled={!note.trim()} onClick={() => void send()}>Send report</Button>
      </div>
    </div>
  );
}

/** One field that needs the user: why, a click to it on the page, and Wera's guess to use when it has one. */
function NeedRow({ r, onUse }: { r: Row; onUse: (value: string) => void }) {
  const guess = isGuess(r);
  // A guess among a few listed choices: every choice is a button, Wera's first, so either answer is one click.
  const choices = guess && r.options.length >= 2 && r.options.length <= 4 && r.options.includes(r.value) && r.options.every((o) => o.length <= 28)
    ? [r.value, ...r.options.filter((o) => o !== r.value)] : null;
  const why = r.chosen ? `Wera chose "${r.result || r.value}": check it`
    : r.drafted ? (r.purpose === 'cover_letter' ? 'Wera wrote this letter for this job: read it in the panel below' : 'Wera drafted this answer: read it and make it yours')
    : r.status === 'review' ? r.result || r.note || 'check it'
    : guess && r.confirm ? `${r.value} · ${r.note}`
    : guess ? `Wera's guess: ${r.value}`
    : r.group === 'consent' ? 'agree yourself after reading it'
    : r.note || 'required: fill it on the page';
  return (
    <li className={clsx('rounded-lg border bg-surface px-2.5 py-2 text-xs', r.drafted || r.chosen ? 'border-accent-2/30' : 'border-warn/30')}>
      <div className="flex items-center gap-2">
        <button type="button" className="min-w-0 flex-1 truncate text-left font-medium text-text hover:underline" onClick={() => void frames('highlight', r.id)} title="Show it on the page">
          {rowLabel(r)}{r.required && <span className="text-bad"> *</span>}
        </button>
        {guess && !choices && <Button className="px-2 py-1" onClick={() => onUse(r.value)}>Use</Button>}
      </div>
      <p className={clsx('mt-0.5 line-clamp-2 text-[11px]', r.drafted || r.chosen ? 'text-accent-2' : 'text-muted')}>{why}</p>
      {choices && (
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={`Answer "${rowLabel(r)}"`}>
          {choices.map((o, i) => (
            <button key={o} type="button" onClick={() => onUse(o)} title={i === 0 ? "Wera's guess" : undefined}
              className={clsx('rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors',
                i === 0 ? 'border-accent/50 bg-accent/10 text-text hover:bg-accent/20' : 'border-border bg-surface-2 text-muted hover:border-accent/40 hover:text-text')}>
              {o}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

/** Resume and cover letter for this application. */
function Docs({ api, page, a }: { api: WeraApi; page: PanelPageState; a: ReturnType<typeof useAutofill> }) {
  const [writing, setWriting] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [tailored, setTailored] = useState(0);
  const job = page.job;
  const score = useTailoredScore(api, job?.id, tailored);
  const chosen = a.resumes.find((r) => r.id === a.selectedResumeId) ?? null;
  const resumeText = !a.resume ? 'none yet' : a.resume.kind === 'tailored' ? (chosen?.title || `tailored for ${job?.company ?? 'this job'}`) : a.resume.kind === 'base' ? (chosen?.title || 'your main resume') : 'your uploaded file';
  const showTailoredScore = !chosen || chosen.job_id === job?.id;
  return (
    <div className="divide-y divide-border rounded-card border border-border bg-surface">
      <div className="space-y-1.5 px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <FileText className="size-4 shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">Resume</p>
            <p className="truncate text-[11px] text-muted">{a.plan ? resumeText : 'attached when Wera fills the form'}</p>
            {showTailoredScore ? <TailoredLine score={score} /> : chosen?.fit_score && (
              <p className="mt-0.5 text-[11px] text-muted">Fit <span className="font-mono font-semibold text-text">{chosen.fit_score.after}</span></p>
            )}
          </div>
          {a.resume?.kind === 'tailored' ? (
            <a href={api.dashboardUrl(job ? `/jobs/${job.id}` : '/profile/resume')} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-accent hover:underline">Edit</a>
          ) : (
            <Button className="px-2 py-1" busy={tailoring} title="Write a copy of your resume for this job" onClick={() => {
              setTailoring(true);
              void a.tailor().then((ok) => ok && setTailored((n) => n + 1)).finally(() => setTailoring(false));
            }}>
              {!tailoring && <Sparkles className="size-3.5" />} Tailor
            </Button>
          )}
        </div>
        {a.resumes.length > 1 && (
          <select aria-label="Choose resume" disabled={switching || a.busy} value={a.selectedResumeId ?? ''}
            onChange={(e) => {
              const id = Number(e.target.value);
              if (!id) return;
              setSwitching(true);
              void a.selectResume(id).finally(() => setSwitching(false));
            }}
            className="w-full rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] text-text focus:border-accent/60 focus:outline-none">
            {a.resumes.map((r) => {
              const tag = r.job_id == null ? (r.is_default ? 'Default' : 'Base') : r.job_id === job?.id ? 'Tailored for this job' : 'Tailored';
              const fit = r.fit_score ? ` · Fit ${r.fit_score.after}` : r.job_id == null && job?.fit_score != null ? ` · Fit ${job.fit_score}` : '';
              return <option key={r.id} value={r.id}>{r.title || tag} ({tag}{fit})</option>;
            })}
          </select>
        )}
      </div>
      <LetterCard a={a} writing={writing} setWriting={setWriting} />
    </div>
  );
}

const TONES: [NonNullable<LetterSteer['tone']>, string][] = [['', 'Any tone'], ['warm', 'Warm'], ['formal', 'Formal'], ['confident', 'Confident'], ['enthusiastic', 'Enthusiastic'], ['concise', 'Concise']];
const LENGTHS: [NonNullable<LetterSteer['length']>, string][] = [['', 'Any length'], ['short', 'Short'], ['standard', 'Standard'], ['long', 'Long']];

/** The cover letter: write it (straight into the form), read it, copy it, edit it, or write it again in another tone or length. */
function LetterCard({ a, writing, setWriting }: { a: ReturnType<typeof useAutofill>; writing: boolean; setWriting: (b: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [tone, setTone] = useState<NonNullable<LetterSteer['tone']>>('');
  const [length, setLength] = useState<NonNullable<LetterSteer['length']>>('');
  const [copied, setCopied] = useState(false);
  const write = (steer?: LetterSteer) => {
    setWriting(true);
    void a.writeLetter(steer).then((ok) => ok && setOpen(true)).finally(() => setWriting(false));
  };
  const select = 'rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] text-text';
  return (
    <div className="space-y-2 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <PenLine className="size-4 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">Cover letter</p>
          <p className="truncate text-[11px] text-muted">{a.letter ? 'written: Wera puts it in the form' : 'none for this job yet'}</p>
        </div>
        {a.letter ? (
          <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline">
            {open ? 'Hide' : 'Read'} <ChevronDown className={clsx('size-3 transition-transform', open && 'rotate-180')} />
          </button>
        ) : (
          <Button className="px-2 py-1" busy={writing} onClick={() => write()}>{!writing && <Sparkles className="size-3.5" />} Write</Button>
        )}
      </div>
      {a.letter && open && (
        <div className="space-y-1.5">
          {editing ? (
            <textarea aria-label="Your cover letter" value={text} onChange={(e) => setText(e.target.value)} rows={10}
              className="w-full resize-y rounded-lg border border-border bg-surface-2 p-2 text-xs text-text" />
          ) : (
            <p className="max-h-56 overflow-y-auto rounded-lg bg-surface-2 p-2 text-xs whitespace-pre-wrap text-text">{a.letter}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {editing ? (
              <>
                <Button className="px-2 py-1" busy={writing} onClick={() => {
                  setWriting(true);
                  void a.saveLetter(text).then((ok) => ok && setEditing(false)).finally(() => setWriting(false));
                }}>Save</Button>
                <button type="button" className="text-[11px] text-muted hover:text-text" onClick={() => setEditing(false)}>Cancel</button>
              </>
            ) : (
              <>
                <Button className="px-2 py-1" onClick={() => {
                  void navigator.clipboard.writeText(a.letter).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1200);
                  }, () => {});
                }}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? 'Copied' : 'Copy'}</Button>
                <Button className="px-2 py-1" onClick={() => { setText(a.letter); setEditing(true); }}>Edit</Button>
              </>
            )}
          </div>
          {!editing && (
            <div className="flex flex-wrap items-center gap-1.5">
              <select aria-label="Tone" value={tone} onChange={(e) => setTone(e.target.value as typeof tone)} className={select}>
                {TONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select aria-label="Length" value={length} onChange={(e) => setLength(e.target.value as typeof length)} className={select}>
                {LENGTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <Button className="px-2 py-1" busy={writing} onClick={() => write({ tone, length })}>{!writing && <RefreshCw className="size-3.5" />} Write again</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
