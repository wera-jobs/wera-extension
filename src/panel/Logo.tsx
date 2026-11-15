import { useId } from 'react';

// The brand's own colors (wera-docs/brand/wera-mark.svg, and the toolbar icon): the mark looks
// the same on every page and in both themes, instead of following the theme's accent.
const CASE_FROM = '#FF7A59';
const CASE_TO = '#F2546A';
const INK = '#0A0B0F';

/** The briefcase mark, in the brand's colors. */
export function LogoMark({ size = 22 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={id} x1="3" y1="6" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={CASE_FROM} />
          <stop offset="1" stopColor={CASE_TO} />
        </linearGradient>
      </defs>
      <path d="M8.75 7V5.25A2.25 2.25 0 0 1 11 3h2a2.25 2.25 0 0 1 2.25 2.25V7" stroke={CASE_FROM} strokeWidth="2" strokeLinecap="round" />
      <rect x="2" y="6.5" width="20" height="14.5" rx="4" fill={`url(#${id})`} />
      <path d="M2 12.75h20" stroke={INK} strokeOpacity="0.3" strokeWidth="1.25" />
      <rect x="10" y="11" width="4" height="3.5" rx="1.25" fill={INK} />
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
