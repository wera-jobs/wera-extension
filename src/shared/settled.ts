// Pages built on the server and then started by a script in the browser
// ("hydrated": React, Next.js, Remix, Vue, Svelte, Angular) compare the
// page with what they built. An element added to the document before
// that, such as the Wera panel, makes React throw its work away and
// rebuild the whole page from scratch (Greenhouse's job boards did, on
// every load): the page flickers, and anything typed or filled is lost.
// So on such pages Wera adds itself only once the page has started.


// Only apps that take over the whole document matter: React then owns <html> and <body>,
// where the panel lives. Apps that start inside one element of the page (a Vite single-page
// app, Next.js's pages router in #__next, Nuxt in #__nuxt) never look at the panel, and
// waiting for them would only make the panel late.
/** Script text of server-rendered React apps that hydrate the whole document (Remix, React Router, Next.js's app router). */
const WHOLE_DOCUMENT = /__remixContext|__reactRouterContext|__staticRouterHydrationData|self\.__next_f/;

export function isHydrated(doc: Document): boolean {
  for (const s of doc.querySelectorAll('script:not([src])')) {
    if (WHOLE_DOCUMENT.test((s.textContent ?? '').slice(0, 4000))) return true;
  }
  return false;
}

/**
 * Resolves when it is safe to add elements to the document: at once on a
 * plain page; on a hydrated one after the page has loaded and gone idle,
 * and at most `cap` ms after the call, so a page that never settles still
 * gets Wera.
 */
export function whenSettled(doc: Document, cap = 2500): Promise<void> {
  if (!isHydrated(doc)) return Promise.resolve();
  const win = doc.defaultView;
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const idle = () => {
      // After the load event the page's own startup has run; one idle moment more lets it finish its first render.
      if (win && 'requestIdleCallback' in win) win.requestIdleCallback(finish, { timeout: 500 });
      else setTimeout(finish, 200);
    };
    if (doc.readyState === 'complete') idle();
    else win?.addEventListener('load', idle, { once: true });
    setTimeout(finish, cap);
  });
}
