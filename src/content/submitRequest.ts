// Detects completed application submissions from the applicant tracking
// system's own HTTP submit request (Workday, Greenhouse, Lever, Ashby,
// iCIMS, Oracle, SuccessFactors, BrassRing), complementing thank-you page
// detection. Only 2xx POST/PUT requests to known submit endpoints qualify;
// drafts, validations, uploads, logins, and telemetry are excluded.

const EXCLUDED = /(draft|save[-_]?for[-_]?later|validate|preview|upload|attachment|resume[-_]?parse|login|sign[-_]?in|auth|oauth|token|telemetry|analytics|metrics|beacon|ping|track|heartbeat|autocomplete|suggest)/i;

const RULES: [string, (u: URL, body: string) => boolean][] = [
  ['Workday', (u) => /(^|\.)myworkday(jobs|site)\.com$/i.test(u.hostname) && (/\/wday\/cxs\/[^/]+\/[^/]+\/job\/.+\/apply(\/|$)/i.test(u.pathname) || /\/apply\/submit(\/|$)|\/SubmitApplication(\/|$)/i.test(u.pathname))],
  ['Greenhouse', (u) => /(^|\.)greenhouse\.io$/i.test(u.hostname) && (/\/(jobs\/\d+|embed\/job_app)\/?$/i.test(u.pathname) || /\/applications\/?$/i.test(u.pathname))],
  ['Lever', (u) => /^jobs(\.eu)?\.lever\.co$/i.test(u.hostname) && /^\/[^/]+\/[0-9a-f-]{36}\/apply\/?$/i.test(u.pathname)],
  ['Ashby', (u, body) => /(^|\.)ashbyhq\.com$/i.test(u.hostname) && (/\/api\/applicationForm\.submit(\/|$)/i.test(u.pathname) || (/\/api\/non-user-graphql\/?$/i.test(u.pathname) && (u.searchParams.get('op') === 'ApiApplicationSubmit' || /"operationName"\s*:\s*"ApiApplicationSubmit"|\bapplicationFormSubmit\b/.test(body))))],
  ['iCIMS', (u) => /(^|\.)icims\.com$/i.test(u.hostname) && /\/jobs\/\d+\/[^?]*\/(candidate|apply|submit)(\/|$)/i.test(u.pathname)],
  ['Oracle', (u) => /\/hcmRestApi\/resources\/[^/]+\/recruitingCEJobApplications(\/|$)/i.test(u.pathname) || (/\/hcmui\/candidateexperience\/.*\/applications(\/submit)?\/?$/i.test(u.pathname))],
  ['SuccessFactors', (u) => /(^|\.)(successfactors|sapsf)\.(com|eu)$/i.test(u.hostname) && /\/(applicationSubmit|submitApplication|career[^/]*\/submit|apply\/submit)(\/|$)/i.test(u.pathname)],
  ['BrassRing', (u) => /(^|\.)brassring\.com$/i.test(u.hostname) && /\/(SubmitApplication|SaveAndSubmit|ApplySubmit)(\/|$)/i.test(u.pathname)],
];

/** Returns the applicant system name if this request is a real application submit, else null. */
export function matchSubmitRequest(url: string, method: string, body = ''): string | null {
  const m = method.toUpperCase();
  if (m !== 'POST' && m !== 'PUT') return null;
  let u: URL;
  try {
    u = new URL(url, typeof location !== 'undefined' ? location.href : 'https://example.invalid');
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (EXCLUDED.test(`${u.pathname}${u.search}`)) return null;
  for (const [system, test] of RULES) {
    if (test(u, body)) return system;
  }
  return null;
}

function bodyTextOf(body: unknown): string {
  if (typeof body === 'string') return body.slice(0, 4000);
  return '';
}

function notify(doc: Document, url: string, system: string) {
  try {
    doc.dispatchEvent(new CustomEvent('wera:submit-request', { detail: { url, system } }));
  } catch {
    // ignore
  }
}

/**
 * Observes fetch and XMLHttpRequest in the page's main world and dispatches
 * a `wera:submit-request` event on `document` when a known ATS submit
 * endpoint succeeds with a 2xx response. Safe to call more than once.
 */
export function installSubmitWatcher(win: Window): void {
  const marked = win as Window & { __weraSubmitWatch?: boolean };
  if (marked.__weraSubmitWatch) return;
  marked.__weraSubmitWatch = true;

  if (typeof win.fetch === 'function') {
    const origFetch = win.fetch.bind(win);
    win.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const reqUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET');
      const body = bodyTextOf(init?.body);
      const system = matchSubmitRequest(reqUrl, method, body);
      const pending = origFetch(input, init);
      if (system) {
        pending.then((res) => {
          if (res.ok) notify(win.document, reqUrl, system);
        }, () => {});
      }
      return pending;
    };
  }

  const xhrCtor = (win as Window & { XMLHttpRequest?: typeof XMLHttpRequest }).XMLHttpRequest;
  if (typeof xhrCtor === 'function') {
    const meta = new WeakMap<XMLHttpRequest, { method: string; url: string }>();
    const proto = xhrCtor.prototype;
    // eslint-disable-next-line @typescript-eslint/unbound-method -- invoked via .call(this, ...) on the XHR instance
    const origOpen = proto.open;
    // eslint-disable-next-line @typescript-eslint/unbound-method -- invoked via .call(this, ...) on the XHR instance
    const origSend = proto.send;
    proto.open = function open(method: string, url: string | URL, ...rest: unknown[]) {
      meta.set(this, { method, url: String(url) });
      return (origOpen as (...a: unknown[]) => void).call(this, method, url, ...rest);
    };
    proto.send = function send(body?: Document | XMLHttpRequestBodyInit | null) {
      const info = meta.get(this);
      const system = info ? matchSubmitRequest(info.url, info.method, bodyTextOf(body)) : null;
      if (system && info) {
        this.addEventListener('load', () => {
          if (this.status >= 200 && this.status < 300) notify(win.document, info.url, system);
        }, { once: true });
      }
      return origSend.call(this, body);
    };
  }
}
