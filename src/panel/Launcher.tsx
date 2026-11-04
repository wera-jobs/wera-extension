// The collapsed panel: Wera's mark on a tab at the right edge. Click it to
// open the panel; drag it up or down (or move it with the arrow keys) to
// keep it clear of the site's own buttons. Where it sits is kept for every
// site, as a share of the window's height.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { LogoMark } from './Logo';

export const LAUNCHER_KEY = 'wera.launcherY';
/** Where the tab sits at first: 40% down the window. */
export const LAUNCHER_DEFAULT = 0.4;
/** A press that moves less than this is a click. */
const DRAG_PX = 5;
/** The tab's height and the room kept above and below it. */
const TAB = 58;
const EDGE = 8;

/** The tab's top in pixels for a share of the window, kept inside it. */
export function launcherTop(share: number, height: number): number {
  return Math.round(Math.min(Math.max(share * height, EDGE), Math.max(EDGE, height - TAB - EDGE)));
}

/** The share of the window a top in pixels is, kept between 0 and 1. */
export function launcherShare(top: number, height: number): number {
  return height > 0 ? Math.min(Math.max(top / height, 0), 1) : LAUNCHER_DEFAULT;
}

function useLauncherShare(): [number, (share: number) => void] {
  const [share, setShare] = useState(LAUNCHER_DEFAULT);
  useEffect(() => {
    void chrome.storage.local.get(LAUNCHER_KEY).then((g) => {
      const v = g[LAUNCHER_KEY];
      if (typeof v === 'number' && v >= 0 && v <= 1) setShare(v);
    }, () => {});
    // Moved in another tab: follow it.
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      const v = changes[LAUNCHER_KEY]?.newValue;
      if (area === 'local' && typeof v === 'number') setShare(v);
    };
    chrome.storage.onChanged?.addListener(onChanged);
    return () => chrome.storage.onChanged?.removeListener(onChanged);
  }, []);
  const save = (v: number) => {
    setShare(v);
    void chrome.storage.local.set({ [LAUNCHER_KEY]: v }).catch(() => {});
  };
  return [share, save];
}

export function Launcher({ onOpen }: { onOpen: () => void }) {
  const [share, setShare] = useLauncherShare();
  const [height, setHeight] = useState(() => window.innerHeight);
  // While dragging: the tab's top in pixels, and where the press started.
  const [dragTop, setDragTop] = useState<number | null>(null);
  const press = useRef<{ y: number; top: number; moved: boolean } | null>(null);

  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const top = dragTop ?? launcherTop(share, height);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    press.current = { y: e.clientY, top, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p) return;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.abs(dy) < DRAG_PX) return;
    p.moved = true;
    setDragTop(launcherTop(launcherShare(p.top + dy, height), height));
  };
  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    press.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (!p) return;
    if (p.moved && dragTop != null) setShare(launcherShare(dragTop, height));
    setDragTop(null);
    if (!p.moved) onOpen();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const step = (e.shiftKey ? 0.1 : 0.03) * (e.key === 'ArrowUp' ? -1 : 1);
    setShare(launcherShare(launcherTop(share + step, height), height));
  };

  return (
    <button type="button" aria-label="Show the Wera panel" title="Wera (Alt+Shift+W). Drag to move it up or down."
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onPointerCancel={() => { press.current = null; setDragTop(null); }}
      // Enter and Space still open it (a click with no pointer).
      onClick={(e) => { if (e.detail === 0) onOpen(); }}
      onKeyDown={onKeyDown}
      style={{ top }}
      className={`group anim-peek panel-shadow fixed right-0 z-[2147483646] grid touch-none place-items-center rounded-l-2xl border border-r-0 border-border bg-surface py-3.5 pr-3 pl-3.5 select-none ${
        dragTop != null ? 'cursor-grabbing pr-4' : 'cursor-pointer transition-[padding,top] duration-150 hover:pr-4'}`}>
      {/* A grip that shows the tab can move. */}
      <span aria-hidden className={`absolute top-1/2 left-1 grid -translate-y-1/2 grid-cols-1 gap-[3px] transition-opacity ${dragTop != null ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {[0, 1, 2].map((i) => <span key={i} className="size-[3px] rounded-full bg-faint" />)}
      </span>
      <LogoMark size={30} />
    </button>
  );
}
