// The job the panel is on, as one card at the top: the company's logo,
// the title, company and place, then chips for what matters before
// applying (pay, how long it has been up, where it is in the tracker),
// and the fit score once Wera has one. Simplify and Jobright open with the
// same card; ours adds the fit and says plainly when it may be too late.
import { useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { CalendarDays, CircleDollarSign, ExternalLink, FileText, MapPin, Send } from 'lucide-react';
import type { ApplicationStatus, WeraApi } from '../shared/api';
import { log } from '../shared/log';
import { ageWords, OLD_POSTING_DAYS } from '../content/facts';
import { hostOf, originOf, siteOf } from '../shared/url';
import { postingFacts } from './PostingFacts';
import { Notice, ScoreRing, Skeleton } from './ui';
import type { PanelPageState } from './usePanelPage';

const STATUS: Record<string, [string, string]> = {
  saved: ['Saved', 'text-accent bg-accent/10'],
  applied: ['Applied', 'text-accent-2 bg-accent-2/10'],
  interviewing: ['Interviewing', 'text-warn bg-warn/10'],
  offer: ['Offer', 'text-good bg-good/10'],
  rejected: ['Rejected', 'text-bad bg-bad/10'],
  not_interested: ['Not interested', 'text-muted bg-surface-2'],
};

// Images that call themselves a logo, as job boards draw a company's. Not any
// image in a header: a signed-in site's header holds the person's own photo.
const LOGO_IMG = '[class*="logo" i] img, img[class*="logo" i], img[alt*="logo" i], img[src*="logo" i]';

// Words that mark a picture of a person (the signed-in member, a recruiter, a poster).
const PERSON = /avatar|profile|photo|headshot|portrait|recruiter|member|person|people|user|account|(?:^|[\s_-])me(?:$|[\s_-])/i;

/** Whether an image is a picture of someone rather than a company's logo: named so, or drawn round. */
function looksLikePerson(img: HTMLImageElement, company: string): boolean {
  if (PERSON.test([img.getAttribute('class'), img.id, img.alt].filter(Boolean).join(' '))) return true;
  // An address says less (a company's logo may sit under /users/), so only the plain words count there.
  if (/avatar|(?:profile|display)-?(?:photo|pic|image)|headshot|portrait/i.test(new URL(img.currentSrc || img.src, img.baseURI).pathname)) return true;
  // People are drawn in circles; logos in squares.
  const radius = img.ownerDocument.defaultView?.getComputedStyle(img).borderRadius ?? '';
  const px = parseFloat(radius);
  if (radius.includes('%') ? px >= 40 : px > 0 && img.width > 0 && px >= img.width / 2.5) return true;
  // "Stripe logo" names the company: trust it even inside a profile card.
  const name = plain(company);
  if (name && plain(img.alt).includes(name)) return false;
  for (let el = img.parentElement, depth = 0; el && depth < 3; el = el.parentElement, depth++) {
    if (PERSON.test([el.getAttribute('class'), el.id, el.getAttribute('aria-label')].filter(Boolean).join(' '))) return true;
  }
  return false;
}

const plain = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Whether a host is the company's own (stripe.com for Stripe), not a job board's or an applicant system's. */
export function ownSite(host: string, company: string): boolean {
  const name = plain(company);
  const site = plain(siteOf(host).split('.')[0] ?? '');
  // By the start of the name, not any part of it: Cleverly is not at home on lever.co.
  return name.length >= 3 && site.length >= 3 && (site.startsWith(name) || (site.length >= 4 && name.startsWith(site)));
}

/** A site's own icons, the largest first, then the two addresses nearly every site answers. */
function siteIcons(doc: Document): string[] {
  const links = [...doc.querySelectorAll<HTMLLinkElement>('link[rel~="apple-touch-icon"], link[rel~="icon"]')]
    .map((l) => ({ href: l.href, size: parseInt(l.getAttribute('sizes') ?? '', 10) || (/apple-touch/.test(l.rel) ? 180 : 16), svg: /svg/.test(l.type) || /\.svg(\?|$)/.test(l.href) }))
    .filter((l) => /^https?:/.test(l.href))
    .sort((x, y) => Number(y.svg) - Number(x.svg) || y.size - x.size);
  return links.map((l) => l.href);
}

/**
 * Where the company's logo may be, best first: the one its job data
 * names, a logo image near the top of the page, then the company's own
 * icon: this site's when the page is on the company's site, else the icon
 * of the site its logo links to (a board's header links home). Never a
 * job board's own icon. The card tries each in turn and falls back to a
 * letter (see Logo).
 */
export function companyLogos(doc: Document, company: string, weraLogo?: string): string[] {
  const out: string[] = [];
  if (weraLogo && /^https?:/.test(weraLogo)) out.push(weraLogo);
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const m = /"logo"\s*:\s*(?:\{[^}]*?"url"\s*:\s*)?"(https?:[^"]+)"/.exec(s.textContent ?? '');
    if (m?.[1]) out.push(m[1]);
  }
  const name = company.trim().toLowerCase();
  let home = '';
  for (const img of doc.querySelectorAll<HTMLImageElement>(LOGO_IMG)) {
    const r = img.getBoundingClientRect();
    const top = r.top + (doc.defaultView?.scrollY ?? 0);
    const src = img.currentSrc || img.src;
    if (!/^https?:/.test(src) || top > 900) continue;
    // The company's site, as its logo links to it from a board.
    const to = img.closest('a')?.href ?? '';
    if (!home && /^https?:/.test(to) && ownSite(hostOf(to), company)) home = originOf(to);
    // A real layout has sizes: skip icons and banners. (jsdom has none: trust the name in alt.)
    if (r.width > 0 && (r.width < 20 || r.height < 20 || r.width / Math.max(r.height, 1) > 5)) continue;
    if (r.width === 0 && !(name && img.alt.toLowerCase().includes(name))) continue;
    if (looksLikePerson(img, company)) continue;
    out.push(src);
  }
  const here = doc.location?.host ?? '';
  if (here && ownSite(here, company)) out.push(...siteIcons(doc), `${doc.location.origin}/apple-touch-icon.png`, `${doc.location.origin}/favicon.ico`);
  else if (home) out.push(`${home}/apple-touch-icon.png`, `${home}/favicon.ico`);
  return [...new Set(out)];
}

// Tile colors for a logo-less company, picked by its name so it stays the same.
const TILES = ['bg-accent/15 text-accent', 'bg-accent-2/15 text-accent-2', 'bg-good/15 text-good', 'bg-warn/15 text-warn'];

function Logo({ srcs, company, trustedSrc }: { srcs: string[]; company: string; trustedSrc?: string }) {
  // The candidate being shown; one that fails to load, or would not read in a square, gives way to the next.
  const [at, setAt] = useState(0);
  const letter = (company.trim()[0] ?? 'W').toUpperCase();
  const tile = TILES[[...company].reduce((n, c) => n + c.charCodeAt(0), 0) % TILES.length];
  const src = srcs[at];
  if (src) {
    const trusted = !!trustedSrc && src === trustedSrc;
    return (
      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white p-1">
        <img key={src} src={src} alt="" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" onError={() => setAt((n) => n + 1)}
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            // Wera's own stored logos are already vetted (including wordmarks); scraped page images must fit a square.
            if (trusted ? w === 0 || h === 0 : w > 1.7 * h || h > 1.7 * w || (w > 0 && w < 24)) setAt((n) => n + 1);
          }} />
      </span>
    );
  }
  return <span aria-hidden className={clsx('grid size-11 shrink-0 place-items-center rounded-xl text-lg font-semibold', tile)}>{letter}</span>;
}

function Chip({ icon, children, tone = 'plain', title }: { icon?: ReactNode; children: ReactNode; tone?: 'plain' | 'warn' | 'bad'; title?: string }) {
  return (
    <span title={title} className={clsx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-4 whitespace-nowrap',
      tone === 'warn' ? 'bg-warn/10 text-warn' : tone === 'bad' ? 'bg-bad/10 text-bad' : 'bg-surface-2 text-muted')}>
      {icon}{children}
    </span>
  );
}

/** The job at the top of the panel. */
export function JobHeader({ api, page, kind }: { api: WeraApi | null; page: PanelPageState; kind: 'form' | 'posting' | null }) {
  const job = page.job;
  const draft = page.info?.draft ?? page.handle.draft;
  const title = job?.title || draft?.title || page.handle.title || 'This job';
  const company = job?.company || draft?.company || page.handle.company || '';
  const place = job?.location_raw || draft?.location || '';
  const weraLogo = job?.logo_url ? (/^https?:/.test(job.logo_url) ? job.logo_url : api?.dashboardUrl(job.logo_url) ?? '') : '';
  const logos = useMemo(() => companyLogos(document, company, weraLogo || undefined), [company, weraLogo]);
  const facts = postingFacts(job, draft, page.info?.text ?? '');
  const [status, statusCls] = job?.application_status ? STATUS[job.application_status] ?? [job.application_status, STATUS.not_interested![1]] : ['', ''];
  const score = job ? (job.fit_score ?? job.estimated_score) : null;
  const old = facts.age != null && facts.age > OLD_POSTING_DAYS;
  // Seen gone, or past its own end date: worth a sentence. Merely old: a chip says it.
  const gone = !!facts.warning && !old;
  const site = page.form?.site ?? page.info?.site;
  const step = page.form?.step ?? page.info?.step;
  return (
    <div className="anim-rise space-y-2.5">
      <div className="flex items-start gap-3">
        {page.loading && !job && !draft ? <Skeleton className="size-11 rounded-xl" /> : <Logo key={logos.join(' ')} srcs={logos} company={company} trustedSrc={weraLogo || undefined} />}
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[15px] leading-snug font-semibold tracking-tight text-text">{title}</h2>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-muted">
            <span className="max-w-[60%] shrink-0 truncate">{company}</span>
            {place && <><span aria-hidden className="text-faint">·</span><MapPin className="size-3 shrink-0 text-faint" /><span className="truncate">{place}</span></>}
          </p>
        </div>
        {score != null && <ScoreRing score={score} estimate={job!.fit_score == null && job!.estimated_score != null} />}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" aria-label="About this job">
        {kind && (
          <Chip icon={kind === 'form' ? <Send className="size-3" /> : <FileText className="size-3" />}>
            {[kind === 'form' ? 'Application' : 'Job posting', site].filter(Boolean).join(' · ')}
          </Chip>
        )}
        {step && <Chip>{[`Step ${step.index} of ${step.total}`, step.name].filter(Boolean).join(' · ')}</Chip>}
        {facts.pay && <Chip icon={<CircleDollarSign className="size-3" />} title="The pay the posting states">{facts.pay}</Chip>}
        {facts.age != null && (
          <Chip icon={<CalendarDays className="size-3" />} tone={old ? 'warn' : 'plain'} title={old ? facts.warning : undefined}>
            Posted {ageWords(facts.age)}
          </Chip>
        )}
        {job && api ? <StatusPicker api={api} page={page} /> : status && <span className={clsx('rounded-md px-1.5 py-0.5 text-[11px] leading-4 font-medium', statusCls)}>{status}</span>}
        {job?.early && <Chip tone="plain" title="Posted in the last three days">Early</Chip>}
        {job && api && job.company_id != null && <FollowButton api={api} page={page} />}
        {job && api && (
          <a href={api.dashboardUrl(`/jobs/${job.id}`)} target="_blank" rel="noreferrer"
            className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-medium text-accent hover:underline">
            Open in Wera <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      {gone && <Notice tone="warn">{facts.warning}</Notice>}
    </div>
  );
}

const STATUS_ORDER: ApplicationStatus[] = ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'not_interested'];

/** The job's tracker status, changed in place. */
function StatusPicker({ api, page }: { api: WeraApi; page: PanelPageState }) {
  const job = page.job!;
  const [busy, setBusy] = useState(false);
  const current = job.application_status ?? '';
  const cls = current ? STATUS[current]?.[1] ?? STATUS.not_interested![1] : 'text-muted bg-surface-2';
  return (
    <select aria-label="Tracker status" value={current} disabled={busy}
      onChange={(e) => {
        const next = e.target.value as ApplicationStatus;
        if (!next) return;
        setBusy(true);
        api.setStatus(job.id, next).then((j) => page.setJob(j), (err: unknown) => log.warn('status', 'changing the status failed', err)).finally(() => setBusy(false));
      }}
      className={clsx('rounded-md border-0 px-1.5 py-0.5 text-[11px] leading-4 font-medium', cls)}>
      {!current && <option value="">Not tracked</option>}
      {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s]![0]}</option>)}
    </select>
  );
}

/** Follow the company: its new roles show up as a notice in Wera. */
function FollowButton({ api, page }: { api: WeraApi; page: PanelPageState }) {
  const job = page.job!;
  const [on, setOn] = useState(!!job.company_followed);
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" aria-pressed={on} disabled={busy} title={on ? 'You follow this company: its new roles show up in Wera' : 'Follow: hear when this company posts a role'}
      onClick={() => {
        setBusy(true);
        api.followCompany(job.company_id!, !on).then(() => {
          setOn(!on);
          page.setJob({ ...job, company_followed: !on });
        }, (e: unknown) => log.warn('follow', 'following the company failed', e)).finally(() => setBusy(false));
      }}
      className={clsx('rounded-md px-1.5 py-0.5 text-[11px] leading-4 font-medium', on ? 'bg-accent/10 text-accent' : 'bg-surface-2 text-muted hover:text-text')}>
      {on ? 'Following' : 'Follow'}
    </button>
  );
}
