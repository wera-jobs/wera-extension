// What the tab's × leaves behind for a few seconds: Wera is hidden from
// this page, with Undo, and the longer ways to hide it. It then goes too;
// the toolbar icon (Alt+Shift+W) brings Wera back.
import { useEffect, useRef, useState } from 'react';
import type { HideChoice } from './Launcher';

/** How long the note stays when left alone. */
export const HIDDEN_NOTE_MS = 8000;

export function HiddenToast({ onUndo, onHide, onDone }: { onUndo: () => void; onHide: (how: Exclude<HideChoice, 'visit'>) => void; onDone: () => void }) {
  const [hover, setHover] = useState(false);
  // The page re-renders the panel often: the timer runs from when the note shows, not from each render.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (hover) return;
    const t = window.setTimeout(() => done.current(), HIDDEN_NOTE_MS);
    return () => window.clearTimeout(t);
  }, [hover]);
  const link = 'rounded px-1.5 py-1 font-medium text-text underline-offset-2 hover:bg-surface-2 hover:underline';
  return (
    <div role="status" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="anim-rise panel-shadow fixed right-3 bottom-3 z-[2147483646] w-[300px] rounded-xl border border-border bg-surface p-3 text-xs text-muted">
      <p className="text-text">Wera is hidden on this page.</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
        <button type="button" className={link} onClick={onUndo}>Undo</button>
        <span aria-hidden>·</span>
        <button type="button" className={link} onClick={() => onHide('site')}>Hide on this site</button>
        <span aria-hidden>·</span>
        <button type="button" className={link} onClick={() => onHide('everywhere')}>Hide everywhere</button>
      </div>
      <p className="mt-1 text-[10px] text-faint">Bring it back any time from the toolbar icon (Alt+Shift+W).</p>
    </div>
  );
}
