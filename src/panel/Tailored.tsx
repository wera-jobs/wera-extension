// What tailoring the resume did for a job: the fit score before and with
// the tailored resume, and the share of the job's keywords it shows.
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { WeraApi } from '../shared/api';
import { log } from '../shared/log';

export interface TailoredScore {
  fit: { before: number; after: number } | null;
  keywords: { before: number | null; after: number } | null;
}

/** The job's tailored resume scores, read again whenever `version` changes; null when there is no tailored resume. */
export function useTailoredScore(api: WeraApi, jobId: number | null | undefined, version: number): TailoredScore | null {
  const [score, setScore] = useState<TailoredScore | null>(null);
  useEffect(() => {
    if (jobId == null) return;
    let live = true;
    Promise.all([api.jobResume(jobId), api.jobKeywords(jobId).catch(() => null)]).then(([doc, kw]) => {
      if (!live) return;
      setScore(doc ? {
        fit: doc.fit_score ?? null,
        keywords: doc.coverage ? { before: kw?.coverage?.percent ?? null, after: doc.coverage.percent } : null,
      } : null);
    }, (e: unknown) => log.warn('tailor', "reading the tailored resume's score failed", e));
    return () => {
      live = false;
    };
  }, [api, jobId, version]);
  return score;
}

function Change({ label, before, after, unit = '' }: { label: string; before: number | null; after: number; unit?: string }) {
  const up = before != null && after > before;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className="text-faint">{label}</span>
      {before != null && before !== after && (
        <><span className="font-mono text-muted">{before}{unit}</span><ArrowRight className="size-3 text-faint" /></>
      )}
      <span className={`font-mono font-semibold ${up ? 'text-good' : 'text-text'}`}>{after}{unit}</span>
    </span>
  );
}

/** "Fit 72 → 78 · Keywords 55% → 82%", or nothing before there is a tailored resume. */
export function TailoredLine({ score }: { score: TailoredScore | null }) {
  if (!score || (!score.fit && !score.keywords)) return null;
  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px]" aria-label="What the tailored resume scores">
      {score.fit && <Change label="Fit" before={score.fit.before} after={score.fit.after} />}
      {score.keywords && <Change label="Keywords" before={score.keywords.before} after={score.keywords.after} unit="%" />}
    </p>
  );
}
