// Room for the open panel at the page's right edge, so it never covers the
// site (its Apply button, the form). The page's own content moves over by
// a margin on <html>; bars and buttons fixed to the window ignore that
// margin, so those over the panel's strip are narrowed or moved left.
// Everything is put back when the panel closes. Sites that redraw <html>
// (Greenhouse does on load) lose the margin: it is put back at once.

/** How deep under <body> a fixed bar is looked for: headers, cookie banners and chat buttons sit near the top. */
const DEPTH = 5;
/** Elements looked at for fixed bars at most, so a huge page costs little. */
const LOOK_AT = 1500;

interface Saved {
  right: [string, string];
  maxWidth: [string, string];
}

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

const keep = (el: HTMLElement, prop: string): [string, string] => [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)];

/**
 * Makes room for a panel `px` wide at the right of the window. Returns
 * the undo. Fixed elements that appear later (a cookie banner) are seen
 * when the page changes.
 */
export function makeRoom(doc: Document, px: number): () => void {
  const view = doc.defaultView;
  const root = doc.documentElement;
  if (!view) return () => {};
  const margin = keep(root, 'margin-right');
  const moved = new Map<HTMLElement, Saved>();
  const want = `${px}px`;

  const placeRoot = () => {
    if (root.style.getPropertyValue('margin-right') !== want || root.style.getPropertyPriority('margin-right') !== 'important') {
      root.style.setProperty('margin-right', want, 'important');
    }
  };
  const placeFixed = () => {
    const edge = view.innerWidth - px;
    for (const el of candidates(doc)) {
      if (moved.has(el) || !el.isConnected) continue;
      const s = view.getComputedStyle(el);
      if (s.position !== 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.right <= edge) continue;
      moved.set(el, { right: keep(el, 'right'), maxWidth: keep(el, 'max-width') });
      if (r.left < view.innerWidth / 2) {
        // A bar across the window: narrowed to end where the panel starts.
        el.style.setProperty('max-width', `calc(100vw - ${px}px)`, 'important');
        if (s.right === '0px' && s.left !== '0px') el.style.setProperty('right', want, 'important');
      } else {
        // Something at the right edge (a chat button, a corner banner): moved left of the panel.
        el.style.setProperty('right', `${(parseFloat(s.right) || 0) + px}px`, 'important');
      }
    }
  };

  placeRoot();
  placeFixed();
  // The site took the margin off, or added a fixed bar: put things right (bars at most every 1.5 s, a busy page costs little).
  let timer = 0;
  const watchRoot = new MutationObserver(placeRoot);
  watchRoot.observe(root, { attributes: true, attributeFilter: ['style', 'class'] });
  const watchBody = new MutationObserver(() => {
    if (timer) return;
    timer = view.setTimeout(() => {
      timer = 0;
      placeFixed();
    }, 1500);
  });
  if (doc.body) watchBody.observe(doc.body, { childList: true, subtree: true });

  return () => {
    watchRoot.disconnect();
    watchBody.disconnect();
    view.clearTimeout(timer);
    const put = (el: HTMLElement, prop: string, [v, p]: [string, string]) => (v ? el.style.setProperty(prop, v, p) : el.style.removeProperty(prop));
    put(root, 'margin-right', margin);
    for (const [el, saved] of moved) {
      put(el, 'right', saved.right);
      put(el, 'max-width', saved.maxWidth);
    }
  };
}
