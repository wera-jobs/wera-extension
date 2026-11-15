import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LogoMark } from './Logo';

describe("Wera's logo in the extension", () => {
  it("is drawn in the brand's own colors, as the toolbar icon is, whatever the theme", () => {
    const { container } = render(<LogoMark />);
    const svg = container.innerHTML;
    expect(svg).toContain('#FF7A59');
    expect(svg).toContain('#F2546A');
    expect(svg).not.toContain('var(--color-accent)');
  });

  it("uses the dashboard's light colors (wera-frontend src/index.css), not an older copy", () => {
    const css = readFileSync('src/panel/styles.css', 'utf8');
    const light = css.slice(css.indexOf('[data-theme="light"]'));
    expect(light).toContain('--color-accent: #AA4220;');
    expect(light).not.toContain('#D9653F');
  });
});
