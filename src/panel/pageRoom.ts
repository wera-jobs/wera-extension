// Room for the open panel at the page's right edge, so it never covers the
// site (its Apply button, the form). The page's own content moves over by
// a margin on <html>; bars and buttons fixed to the window ignore that
// margin, so those over the panel's strip are narrowed or moved left.
// Everything is put back when the panel closes. Sites that redraw <html>
// (Greenhouse does on load) lose the margin: it is put back at once.
// Some pages cannot get narrower: site builders such as Framer pick a
// desktop layout with a fixed minimum width from the window's width, so
// the margin alone leaves their content (and Apply) under the panel.
// Those pages are scaled down to fit instead, keeping their layout: zoom
// on <body>, since the panel itself hangs off <html>.

/** How deep under <body> a fixed bar is looked for: headers, cookie banners and chat buttons sit near the top. */
const DEPTH = 5;
/** Elements looked at for fixed bars at most, so a huge page costs little. */
const LOOK_AT = 1500;

interface Saved {
  right: [string, string];
  maxWidth: [string, string];
  zIndex: [string, string];
}

/** Above the page, below the panel (2147483646). */
const LIFTED = '2147483000';

/** The elements near the top of <body> and the usual names of bars: where fixed bars live. */
function candidates(doc: Document): HTMLElement[] {
  const out = new Set<HTMLElement>();
  let level: Element[] = doc.body ? [...doc.body.children] : [];
  for (let d = 0; d < DEPTH && level.length && out.size < LOOK_AT; d++) {
    const next: Element[] = [];
    for (const el of level) {
      if (el instanceof HTMLElement && el.localName !== 'wera-panel') out.add(el);
      next.push(...el.children);
    }
    level = next;
  }
  doc.querySelectorAll<HTMLElement>('header, nav, [role="banner"], [class*="header" i], [class*="cookie" i], [id*="cookie" i], [class*="banner" i]')
    .forEach((el) => out.size < LOOK_AT * 1.5 && out.add(el));
  return [...out];
}

/** What sits under the panel's strip: fixed bars at any depth (Dropbox's floating Apply bar, Workable's cookie bar). */
function underStrip(doc: Document, view: Window, edge: number): HTMLElement[] {
  const out = new Set<HTMLElement>();
  const seen = new Set<Element>();
  // Every 40 px across: a narrow sidebar or button falls between sparser samples.
  const xs: number[] = [];
  for (let x = edge + 8; x < view.innerWidth; x += 40) xs.push(x);
  for (let i = 0; i < 12; i++) {
    const y = ((i + 0.5) * view.innerHeight) / 12;
    for (const x of xs) {
      for (const hit of doc.elementsFromPoint?.(x, y) ?? []) {
        // The nearest fixed ancestor is what has to move.
        for (let el: Element | null = hit; el && el !== doc.body && el !== doc.documentElement; el = el.parentElement) {
          if (seen.has(el)) break;
          seen.add(el);
          if (el instanceof HTMLElement && el.localName !== 'wera-panel' && view.getComputedStyle(el).position === 'fixed') {
            out.add(el);
            break;
          }
        }
      }
    }
  }
  return [...out];
}

const ROOT_CHANGES: MutationObserverInit = { attributes: true, attributeFilter: ['style', 'class'], childList: true };

/** Content this much wider than the room means the page cannot narrow. */
const OVERFLOW_PX = 4;

const keep = (el: HTMLElement, prop: string): [string, string] => [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)];

/**
 * Makes room for a panel `px` wide at the right of the window. Returns
 * the undo. Fixed elements that appear later (a cookie banner) are seen
 * when the page changes.
 */
export function makeRoom(doc: Document, px: number): () => void {
  const view = doc.defaultView;
  if (!view) return () => {};
  // Greenhouse replaces <html> itself once loaded: whatever root the document has now gets the margin.
  let root = doc.documentElement;
  const margin = keep(root, 'margin-right');
  const moved = new Map<HTMLElement, Saved>();
  const want = `${px}px`;
  // 1, or the scale <body> is drawn at when the page cannot narrow.
  let zoom = 1;
  let zoomed: { body: HTMLElement; saved: [string, string] } | null = null;
  const put = (el: HTMLElement, prop: string, [v, p]: [string, string]) => (v ? el.style.setProperty(prop, v, p) : el.style.removeProperty(prop));
  const unmove = () => {
    for (const [el, saved] of moved) {
      put(el, 'right', saved.right);
      put(el, 'max-width', saved.maxWidth);
      put(el, 'z-index', saved.zIndex);
    }
    moved.clear();
  };
  const placeZoom = () => {
    const body = doc.body;
    if (zoom === 1 || !body) return;
    if (zoomed && zoomed.body !== body) zoomed = null;
    zoomed ??= { body, saved: keep(body, 'zoom') };
    if (body.style.getPropertyValue('zoom') !== String(zoom)) body.style.setProperty('zoom', String(zoom), 'important');
  };
  /** Scales the page down when its content is still wider than the room (a fixed-width desktop layout). */
  const fit = () => {
    if (zoom !== 1) return;
    const room = root.getBoundingClientRect().width || view.innerWidth - px;
    const tooWide = candidates(doc).some((el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= room + OVERFLOW_PX || r.height < 1) return false;
      // Only the page's own flow counts: bars, menus and banners lifted out
      // of it (or inside something that is) are placed on their own.
      for (let at: Element | null = el; at && at !== doc.body; at = at.parentElement) {
        const s = view.getComputedStyle(at);
        if (s.position === 'fixed' || s.position === 'absolute' || s.visibility === 'hidden') return false;
      }
      return true;
    });
    if (!tooWide) return;
    // The layout keeps the width it had before the margin (a scrollbar aside).
    zoom = Math.round((room / (room + px)) * 1000) / 1000;
    // Bars moved before the scale was known are placed again with it.
    unmove();
    placeZoom();
  };

  const placeRoot = () => {
    const now = doc.documentElement;
    if (!now) return;
    if (now !== root) {
      root = now;
      watchRoot.disconnect();
      watchRoot.observe(root, ROOT_CHANGES);
    }
    if (root.style.getPropertyValue('margin-right') !== want || root.style.getPropertyPriority('margin-right') !== 'important') {
      root.style.setProperty('margin-right', want, 'important');
    }
  };
  const placeFixed = () => {
    const edge = view.innerWidth - px;
    fit();
    for (const el of new Set([...candidates(doc), ...underStrip(doc, view, edge)])) {
      if (moved.has(el) || !el.isConnected) continue;
      const s = view.getComputedStyle(el);
      if (s.position !== 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.right <= edge) continue;
      moved.set(el, { right: keep(el, 'right'), maxWidth: keep(el, 'max-width'), zIndex: keep(el, 'z-index') });
      if (r.left < view.innerWidth / 2) {
        // A bar across the window: narrowed to end where the panel starts.
        // Lengths inside a scaled <body> are drawn `zoom` times smaller.
        el.style.setProperty('max-width', zoom === 1 ? `calc(100vw - ${px}px)` : `${Math.floor(edge / zoom)}px`, 'important');
        if (s.right === '0px' && s.left !== '0px') el.style.setProperty('right', `${px / zoom}px`, 'important');
      } else {
        // Something at the right edge (a chat button, a corner banner): moved left of the panel.
        el.style.setProperty('right', `${(parseFloat(s.right) || 0) + px / zoom}px`, 'important');
        // Out of its gutter it can land under the page's own content
        // (Dropbox's Apply bar went under an image): lifted only then.
        const q = el.getBoundingClientRect();
        const hit = doc.elementFromPoint?.(q.left + q.width / 2, q.top + q.height / 2);
        if (hit && !el.contains(hit) && hit.localName !== 'wera-panel') el.style.setProperty('z-index', LIFTED, 'important');
      }
    }
  };

  // The site took the margin off, or put in a new <body>.
  const watchRoot = new MutationObserver(() => {
    placeRoot();
    followBody();
  });
  watchRoot.observe(root, ROOT_CHANGES);
  // A new <html>: the margin and the bars again.
  const watchDoc = new MutationObserver(() => {
    placeRoot();
    followBody();
    schedule();
  });
  watchDoc.observe(doc, { childList: true });
  // A fixed bar added later (a cookie banner): at most every 1.5 s, so a busy page costs little.
  let timer = 0;
  const schedule = () => {
    if (timer) return;
    timer = view.setTimeout(() => {
      timer = 0;
      placeFixed();
    }, 1500);
  };
  let watchedBody: HTMLElement | null = null;
  const watchBody = new MutationObserver(schedule);
  const followBody = () => {
    placeZoom();
    if (doc.body && doc.body !== watchedBody) {
      watchedBody = doc.body;
      watchBody.disconnect();
      watchBody.observe(doc.body, { childList: true, subtree: true });
    }
  };
  // Bars some sites fix in place only once the page scrolls (a header that sticks).
  view.addEventListener('scroll', schedule, { passive: true });
  placeRoot();
  placeFixed();
  followBody();

  return () => {
    watchRoot.disconnect();
    watchDoc.disconnect();
    watchBody.disconnect();
    view.removeEventListener('scroll', schedule);
    view.clearTimeout(timer);
    put(doc.documentElement, 'margin-right', margin);
    if (zoomed) put(zoomed.body, 'zoom', zoomed.saved);
    unmove();
  };
}
