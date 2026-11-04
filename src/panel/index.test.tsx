import { describe, expect, it } from 'vitest';
import { remToPx } from './index';

describe('the panel styles', () => {
  it('size in pixels, whatever the page sets its font to', () => {
    expect(remToPx('--spacing:.25rem;font-size:var(--text-xs,0.75rem);margin:-1.5rem 2rem')).toBe(
      '--spacing:4px;font-size:var(--text-xs,12px);margin:-24px 32px',
    );
    // Class names and other units stay as they are.
    expect(remToPx('.w-\\[3rem\\]{width:3rem}.remote{letter-spacing:.025em}')).toBe('.w-\\[3rem\\]{width:48px}.remote{letter-spacing:.025em}');
  });
});
