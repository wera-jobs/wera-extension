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
  ['SmartRecruiters', (u) => /(^|\.)smartrecruiters\.com$/i.test(u.hostname) && /\/(applications?|apply)(\/submit)?\/?$/i.test(u.pathname)],
  ['Workable', (u) => /(^|\.)workable\.com$/i.test(u.hostname) && /\/jobs\/[^/]+\/(apply|candidates)\/?$/i.test(u.pathname)],
  ['BambooHR', (u) => /(^|\.)bamboohr\.com$/i.test(u.hostname) && /\/careers\/(\d+\/)?(apply|application)\/?$/i.test(u.pathname)],
  ['Jobvite', (u) => /(^|\.)jobvite\.com$/i.test(u.hostname) && /\/(apply|application)(\/submit)?\/?$/i.test(u.pathname)],
  ['Rippling', (u) => /(^|\.)rippling\.com$/i.test(u.hostname) && /\/jobs?\/[^/]+\/(apply|applications?)\/?$/i.test(u.pathname)],
  ['Taleo', (u) => /(^|\.)taleo\.net$/i.test(u.hostname) && /\/(submit|applicationSubmit|apply\/submit)/i.test(u.pathname)],
  ['Paylocity', (u) => /(^|\.)paylocity\.com$/i.test(u.hostname) && /\/Recruiting\/Jobs\/(Apply|Submit)/i.test(u.pathname)],
  ['ADP', (u) => /(^|\.)adp\.com$/i.test(u.hostname) && /\/(job-?applications?|apply)\/?(submit)?$/i.test(u.pathname)],
  ['UKG', (u) => /(^|\.)(ultipro|ukg)\.(com|net)$/i.test(u.hostname) && /\/JobBoard\/.*\/(Apply|Submit)/i.test(u.pathname)],
  ['Teamtailor', (u) => /(^|\.)teamtailor\.com$/i.test(u.hostname) && /\/jobs\/[^/]+\/(applications?|apply)\/?$/i.test(u.pathname)],
  ['Personio', (u) => /(^|\.)personio\.(de|com)$/i.test(u.hostname) && /\/(job\/\d+\/)?(apply|application)\/?$/i.test(u.pathname)],
  ['JazzHR', (u) => /(^|\.)applytojob\.com$/i.test(u.hostname) && /\/apply(\/[^/]+)?\/?$/i.test(u.pathname)],
  ['Breezy', (u) => /(^|\.)breezy\.hr$/i.test(u.hostname) && /\/p\/[^/]+\/(apply|submit)\/?$/i.test(u.pathname)],
];

/**
 * Whether a 2xx reply still says the submit failed: GraphQL's {"errors": [...]}, or
 * {"success": false} / {"ok": false} / {"error": ...}. Ashby answers a form it refuses with
 * HTTP 200 and errors.
 */
export function replyRefuses(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith('{')) return false;
  try {
    const j = JSON.parse(t) as Record<string, unknown> & { data?: Record<string, unknown> };
    if (Array.isArray(j.errors) && j.errors.length) return true;
    if (j.success === false || j.ok === false || (typeof j.error === 'string' && j.error) || (j.error && typeof j.error === 'object')) return true;
    // GraphQL mutations that report their own failure: {"data": {"x": {"errors": [...]}}}.
    for (const v of Object.values(j.data ?? {})) {
      const r = v as { errors?: unknown[]; success?: boolean } | null;
      if (r && ((Array.isArray(r.errors) && r.errors.length) || r.success === false)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

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

export function bodyTextOf(body: unknown): string {
  if (typeof body === 'string') return body.slice(0, 4000);
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return body.toString().slice(0, 4000);
  // Form posts: their field names (and short values) say what the request is.
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const parts: string[] = [];
    body.forEach((v, k) => parts.push(typeof v === 'string' ? `${k}=${v.slice(0, 200)}` : `${k}=[file]`));
    return parts.join('&').slice(0, 4000);
  }
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
        pending.then(async (res) => {
          if (!res.ok) return;
          // A 200 that says it refused (GraphQL errors) is no submit.
          const text = /json/i.test(res.headers?.get?.('content-type') ?? '') ? await res.clone().text().catch(() => '') : '';
          if (!replyRefuses(text)) notify(win.document, reqUrl, system);
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
          let text: string;
          try {
            text = this.responseType === '' || this.responseType === 'text' ? this.responseText : '';
          } catch {
            text = '';
          }
          if (this.status >= 200 && this.status < 300 && !replyRefuses(text)) notify(win.document, info.url, system);
        }, { once: true });
      }
      return origSend.call(this, body);
    };
  }
}
