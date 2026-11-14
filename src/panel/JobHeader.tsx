// The job the panel is on, as one card at the top: the company's logo,
// the title, company and place, then chips for what matters before
// applying (pay, how long it has been up, where it is in the tracker),
// and the fit score once Wera has one. Simplify and Jobright open with the
// same card; ours adds the fit and says plainly when it may be too late.
import { useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { CalendarDays, CircleDollarSign, ExternalLink, FileText, MapPin, Send } from 'lucide-react';
import type { WeraApi } from '../shared/api';
import { ageWords, OLD_POSTING_DAYS } from '../content/facts';
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

// Images that name the company in a page's header, as job boards draw them.
const LOGO_IMG = 'header img, [class*="logo" i] img, img[class*="logo" i], img[alt*="logo" i], img[src*="logo" i]';

/**
 * The company's logo on this page: the one its job data names, else a
 * logo image near the top of the page. Never the site's icon: on a job
 * board that is the board's, not the company's.
 */
export function companyLogo(doc: Document, company: string): string {
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const m = /"logo"\s*:\s*(?:\{[^}]*?"url"\s*:\s*)?"(https?:[^"]+)"/.exec(s.textContent ?? '');
    if (m?.[1]) return m[1];
  }
  const name = company.trim().toLowerCase();
  for (const img of doc.querySelectorAll<HTMLImageElement>(LOGO_IMG)) {
    const r = img.getBoundingClientRect();
    const top = r.top + (doc.defaultView?.scrollY ?? 0);
    const src = img.currentSrc || img.src;
    if (!/^https?:/.test(src) || top > 900) continue;
    // A real layout has sizes: skip icons and banners. (jsdom has none: trust the name in alt.)
    if (r.width > 0 && (r.width < 20 || r.height < 20 || r.width / Math.max(r.height, 1) > 5)) continue;
    if (r.width === 0 && !(name && img.alt.toLowerCase().includes(name))) continue;
    return src;
  }
  return '';
}

// Tile colors for a logo-less company, picked by its name so it stays the same.
const TILES = ['bg-accent/15 text-accent', 'bg-accent-2/15 text-accent-2', 'bg-good/15 text-good', 'bg-warn/15 text-warn'];

function Logo({ src, company }: { src: string; company: string }) {
  const [failed, setFailed] = useState(false);
  const letter = (company.trim()[0] ?? 'W').toUpperCase();
  const tile = TILES[[...company].reduce((n, c) => n + c.charCodeAt(0), 0) % TILES.length];
  if (src && !failed) {
    return (
      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white p-1">
        <img src={src} alt="" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" onError={() => setFailed(true)}
          // A wordmark much wider than tall turns to a smudge in a square: the letter reads better.
          onLoad={(e) => e.currentTarget.naturalWidth > 2.2 * e.currentTarget.naturalHeight && setFailed(true)} />
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
  const logo = useMemo(() => companyLogo(document, company), [company]);
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
        {page.loading && !job && !draft ? <Skeleton className="size-11 rounded-xl" /> : <Logo src={logo} company={company} />}
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
        {status && <span className={clsx('rounded-md px-1.5 py-0.5 text-[11px] leading-4 font-medium', statusCls)}>{status}</span>}
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
