import { useId } from 'react';

/**
 * The briefcase mark, drawn exactly as the dashboard draws it. On Wera's
 * own color (the launcher tab) it is drawn `solid`: the case in the page
 * color, as the label of a primary button is, with the clasp cut out.
 */
export function LogoMark({ size = 22, solid }: { size?: number; solid?: boolean }) {
  const id = useId();
  const ink = solid ? 'var(--color-bg)' : 'var(--color-accent)';
  const cut = solid ? 'var(--color-accent)' : 'var(--color-bg)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      {!solid && (
        <defs>
          <linearGradient id={id} x1="3" y1="6" x2="21" y2="21" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--color-accent)" />
            <stop offset="1" stopColor="color-mix(in oklab, var(--color-accent) 70%, #ff3d6e)" />
          </linearGradient>
        </defs>
      )}
      <path d="M8.75 7V5.25A2.25 2.25 0 0 1 11 3h2a2.25 2.25 0 0 1 2.25 2.25V7" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <rect x="2" y="6.5" width="20" height="14.5" rx="4" fill={solid ? ink : `url(#${id})`} />
      <path d="M2 12.75h20" stroke={cut} strokeOpacity={solid ? 0.45 : 0.35} strokeWidth="1.25" />
      <rect x="10" y="11" width="4" height="3.5" rx="1.25" fill={cut} />
    </svg>
  );
}

/** Mark plus the "wera" wordmark, at the dashboard's size (its Logo, size md). */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={22} />
      <span className="font-mono text-lg font-semibold tracking-tight text-text">wera</span>
    </span>
  );
}
