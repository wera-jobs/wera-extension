// The alert after the user sends an application and the site confirms
// it: "Job applied", what Wera did (marked Applied, added it, or could not
// find it), a short countdown, then Wera leaves the page, or the tab
// closes when the user wants that. Hovering over the alert pauses the
// countdown; "Undo" and the next match are there meanwhile.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CircleCheck } from 'lucide-react';
import type { WeraApi, WeraJob } from '../shared/api';
import { describeError } from '../shared/errors';
import type { SubmitReply } from '../shared/jobs';
import { log } from '../shared/log';
import { rpc } from '../shared/rpc';
import { Button } from './ui';

/** Seconds the alert shows before Wera leaves (or the tab closes). */
export const CLOSE_AFTER = 5;
/** Seconds when it offers a next match: there is more to read and decide. */
export const CLOSE_WITH_NEXT = 12;

export type Confirmed = Exclude<SubmitReply, { state: 'off' }>;

/** What the alert says Wera did with the application. */
export function appliedMessage(s: Confirmed): { title: string; detail: string } {
  const role = (j: { title: string; company: string }) => (j.company ? `${j.title} at ${j.company}` : j.title);
  switch (s.state) {
    case 'marked':
      return { title: 'Job applied', detail: s.added ? `${role(s.job)} was added to your Wera tracker as Applied.` : `${role(s.job)} is now Applied in your Wera tracker.` };
    case 'already':
      return { title: 'Job applied', detail: `${role(s.job)} is already in your Wera tracker.` };
    case 'unknown':
      return { title: 'Job applied', detail: s.draft ? `${role(s.draft)} is not in Wera, so it was not tracked.` : 'This job is not in Wera, so it was not tracked.' };
  }
}

/** The job the user just applied to, when Wera knows it. */
const jobOf = (r: Confirmed) => (r.state === 'unknown' ? null : r.job.id);

/** The user's next best match, while they have momentum. Nothing shows when there is none or Wera can't say. */
export function useNextMatch(api: WeraApi | null, after: number | null): WeraJob | null {
  const [next, setNext] = useState<WeraJob | null>(null);
  useEffect(() => {
    if (!api) return;
    let gone = false;
    api.nextMatch(after).then((j) => {
      if (!gone) setNext(j);
    }, (e: unknown) => log.warn('panel', 'finding the next match failed', e));
    return () => {
      gone = true;
    };
  }, [api, after]);
  return next;
}

/** Offers the next match, with the fit that makes it worth opening. */
export function NextMatch({ job, onOpen }: { job: WeraJob; onOpen: () => void }) {
  const score = job.fit_score ?? job.estimated_score;
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-faint">Your next best match{score != null && ` · ${score}% fit`}</p>
        <p className="truncate text-xs font-medium text-text" title={`${job.title} at ${job.company}`}>{job.title} at {job.company}</p>
      </div>
      <Button className="shrink-0 px-2 py-1" onClick={onOpen}>Open it <ArrowRight className="size-3.5" /></Button>
    </div>
  );
}

/**
 * `onDone`: the countdown ran out or the user dismissed it; the panel
 * leaves the page (the tab closes first when `reply.close`). `onUndo`
 * puts the job back where it was, for a job Wera just marked; after it
 * `onStay` closes the alert and the panel stays.
 */
export function AppliedAlert({ api, reply, onDone, onUndo, onStay }: {
  api: WeraApi | null; reply: Confirmed; onDone: () => void; onUndo?: () => Promise<void>; onStay?: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState('');
  const [undone, setUndone] = useState(false);
  const closing = useRef(false);
  const { title, detail } = appliedMessage(reply);
  const next = useNextMatch(api, jobOf(reply));
  const total = next ? CLOSE_WITH_NEXT : CLOSE_AFTER;
  const left = Math.max(0, total - elapsed);
  const closeTab = !!reply.close && !undone;

  const openNext = useCallback(() => {
    if (!next) return;
    closing.current = true; // the tab has somewhere to go now
    rpc({ type: 'wera:open-next', jobId: next.id, url: next.url }).catch((e: unknown) => {
      closing.current = false;
      setError(describeError(e, "Couldn't open that job"));
    });
  }, [next]);

  const finish = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (!closeTab) return onDone();
    rpc({ type: 'wera:tab-close' }).then(onDone, (e: unknown) => {
      closing.current = false;
      setError(describeError(e, "Couldn't close this tab"));
    });
  }, [closeTab, onDone]);

  useEffect(() => {
    if (paused || undone) return;
    const t = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [paused, undone]);
  useEffect(() => {
    if (left === 0 && !error && !undone) finish();
  }, [left, error, undone, finish]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (undone ? (onStay ?? onDone) : onDone)();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onDone, onStay, undone]);

  const undo = async () => {
    if (!onUndo) return;
    try {
      await onUndo();
      setUndone(true);
    } catch (e) {
      setError(describeError(e, "Couldn't undo"));
    }
  };

  const status = error || (undone ? 'Moved back. Wera stays on this page.'
    : paused ? 'Paused while you read.'
    : left > 0 ? (closeTab ? `Closing this tab in ${left} s…` : `Wera leaves this page in ${left} s…`) : 'Done.');

  return (
    <div className="fixed inset-0 z-[2147483647] grid place-items-center bg-black/30 p-4" onClick={(e) => e.target === e.currentTarget && (undone ? (onStay ?? onDone) : onDone)()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="wera-applied-title" aria-describedby="wera-applied-detail"
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        className="anim-rise panel-shadow w-[380px] max-w-full overflow-hidden rounded-card border border-border bg-bg">
        <div className="flex gap-3 p-4">
          <CircleCheck className="mt-0.5 size-7 shrink-0 text-good" />
          <div className="min-w-0 flex-1">
            <h2 id="wera-applied-title" className="text-base font-semibold">{undone ? 'Moved back' : title}</h2>
            <p id="wera-applied-detail" className="mt-1 text-xs text-muted">{detail}</p>
            <p className="mt-2 text-xs text-faint" aria-live="polite">{status}</p>
          </div>
        </div>
        {next && !undone && <div className="px-4 pb-3"><NextMatch job={next} onOpen={openNext} /></div>}
        <div className="h-1 bg-surface-2">
          <div className="h-full bg-good transition-[width] duration-1000 ease-linear" style={{ width: `${undone ? 0 : (left / total) * 100}%` }} />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface px-4 py-3">
          {reply.state === 'marked' && onUndo && !undone && (
            <button type="button" className="mr-auto text-xs text-faint hover:text-text" onClick={() => void undo()}>Undo</button>
          )}
          {undone ? <Button variant="primary" autoFocus onClick={onStay ?? onDone}>OK</Button> : closeTab ? (
            <>
              <Button onClick={onDone}>Keep this tab</Button>
              <Button variant="primary" autoFocus onClick={finish}>Close now</Button>
            </>
          ) : (
            <Button variant="primary" autoFocus onClick={finish}>OK</Button>
          )}
        </div>
      </div>
    </div>
  );
}
