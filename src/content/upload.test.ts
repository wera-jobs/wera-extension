import { describe, expect, it } from 'vitest';
import { verifyFileUpload } from './fill';

const file = (input: HTMLInputElement) => {
  const dt = new DataTransfer();
  dt.items.add(new File(['%PDF'], 'Ada_Resume.pdf', { type: 'application/pdf' }));
  input.files = dt.files;
};

describe('checking an upload took', () => {
  it('waits for a dropzone that clears the box and shows the file later', async () => {
    document.body.innerHTML = '<div class="field"><input type="file" id="f"><div id="pill"></div></div>';
    const input = document.querySelector<HTMLInputElement>('#f')!;
    setTimeout(() => (document.querySelector('#pill')!.innerHTML = '<div role="progressbar"></div>'), 20);
    setTimeout(() => (document.querySelector('#pill')!.textContent = 'Ada_Resume.pdf'), 900);
    expect(await verifyFileUpload(input, 'Ada_Resume.pdf')).toEqual({ ok: true });
  });

  it('catches the site rejecting the file after a moment', async () => {
    document.body.innerHTML = '<div class="field"><input type="file" id="f"><div id="msg"></div></div>';
    const input = document.querySelector<HTMLInputElement>('#f')!;
    setTimeout(() => (document.querySelector('#msg')!.innerHTML = '<div role="progressbar"></div>'), 20);
    setTimeout(() => (document.querySelector('#msg')!.innerHTML = '<p role="alert">File is too large</p>'), 600);
    expect((await verifyFileUpload(input, 'Ada_Resume.pdf')).ok).toBe(false);
  });

  it('is quick for a plain file box that keeps the file', async () => {
    document.body.innerHTML = '<div class="field"><input type="file" id="f"></div>';
    const input = document.querySelector<HTMLInputElement>('#f')!;
    file(input);
    const t0 = Date.now();
    expect(await verifyFileUpload(input, 'Ada_Resume.pdf')).toEqual({ ok: true });
    expect(Date.now() - t0).toBeLessThan(600);
  });

  it('gives up on a box that never shows the file', async () => {
    document.body.innerHTML = '<div class="field"><input type="file" id="f"></div>';
    expect((await verifyFileUpload(document.querySelector<HTMLInputElement>('#f')!, 'Ada_Resume.pdf', 400)).ok).toBe(false);
  });
});
