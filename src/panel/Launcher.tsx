// The collapsed panel: Wera's mark on a tab in Wera's color at the right
// edge, so it shows on any page. Click it to open the panel; drag it up or
// down (or move it with the arrow keys) to keep it clear of the site's own
// buttons. Where it sits is kept for every site, as a share of the
// window's height. Its × puts it away: for now, on this site, or everywhere.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { X } from 'lucide-react';
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

/** How the user put the tab away from its × menu. */
export type HideChoice = 'visit' | 'site' | 'everywhere';

const HIDE_CHOICES: [HideChoice, string][] = [
  ['visit', 'Hide until next visit'],
  ['site', 'Hide on this site'],
  ['everywhere', 'Hide on all sites'],
];

export function Launcher({ onOpen, onHide }: { onOpen: () => void; onHide?: (how: HideChoice) => void }) {
  const [menu, setMenu] = useState(false);
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

  // The menu stays until a choice, Escape, or a press anywhere else (not on
  // the pointer leaving: the way from the × to the menu crosses a gap).
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: Event) => {
      if (wrap.current && !e.composedPath().includes(wrap.current)) setMenu(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [menu]);

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

  const shown = menu ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover/tab:pointer-events-auto group-hover/tab:opacity-100 group-focus-within/tab:pointer-events-auto group-focus-within/tab:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100';
  return (
    <div ref={wrap} style={{ top }} className="group/tab fixed right-0 z-[2147483646]"
      onKeyDown={(e) => { if (e.key === 'Escape' && menu) { e.stopPropagation(); setMenu(false); } }}>
      <button type="button" aria-label="Show the Wera panel" title="Wera (Alt+Shift+W). Drag to move it up or down."
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={() => { press.current = null; setDragTop(null); }}
        // Enter and Space still open it (a click with no pointer).
        onClick={(e) => { if (e.detail === 0) onOpen(); }}
        onKeyDown={onKeyDown}
        style={{ height: TAB }}
        className={`anim-peek launcher-shadow flex touch-none items-stretch overflow-hidden rounded-l-2xl bg-accent select-none ${
          dragTop != null ? 'cursor-grabbing' : 'cursor-pointer transition-[filter] duration-150 hover:brightness-110'}`}>
        <span className="grid w-[50px] place-items-center pl-0.5"><LogoMark size={32} solid /></span>
        {/* A grip on its own strip, as a handle is drawn: the tab can move. */}
        <span aria-hidden className={`grid w-3.5 place-items-center bg-black/15 ${dragTop != null ? 'cursor-grabbing' : 'cursor-grab'}`}>
          <span className="grid grid-cols-2 gap-[3px]">
            {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="size-[3px] rounded-full bg-bg opacity-80" />)}
          </span>
        </span>
      </button>
      {onHide && dragTop == null && (
        <button type="button" aria-label="Hide Wera" aria-haspopup="menu" aria-expanded={menu} title="Hide Wera"
          onClick={() => setMenu((m) => !m)}
          className={`absolute -top-2.5 -left-2.5 grid size-6 place-items-center rounded-full bg-text text-bg shadow-[0_0_0_2px_var(--color-bg),0_2px_6px_rgb(0_0_0/0.3)] transition-opacity duration-150 hover:bg-bad hover:text-white ${shown}`}>
          <X className="size-3.5" strokeWidth={2.75} />
        </button>
      )}
      {menu && onHide && (
        <div role="menu" aria-label="Hide Wera" className="anim-rise panel-shadow absolute top-5 right-[calc(100%+8px)] w-48 overflow-hidden rounded-xl border border-border bg-surface py-1 text-xs">
          {HIDE_CHOICES.map(([how, label]) => (
            <button key={how} type="button" role="menuitem" className="block w-full px-3 py-2 text-left text-text hover:bg-surface-2 focus-visible:bg-surface-2"
              onClick={() => { setMenu(false); onHide(how); }}>
              {label}
            </button>
          ))}
          <p className="border-t border-border px-3 pt-1.5 pb-1 text-[10px] leading-snug text-faint">Bring it back any time from the toolbar icon (Alt+Shift+W).</p>
        </div>
      )}
    </div>
  );
}
