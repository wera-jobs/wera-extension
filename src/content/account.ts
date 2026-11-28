// A job site's own account page (Workday wants one per company): Wera fills
// the email and the person's job-site password (kept in this browser, see
// background/vault.ts), in the password box and its confirmation, and never
// presses the page's button or ticks its terms.
import { setNativeValue } from './fill';
import { isHidden } from './fields';

/** Whether the page creates an account or signs in to one, from its own markers and words. */
function pageOf(doc: Document, passwords: number): 'create' | 'sign-in' | null {
  if (doc.querySelector('[data-automation-id="createAccountSubmitButton"], [data-automation-id="verifyPassword"]') || passwords >= 2) return 'create';
  if (doc.querySelector('[data-automation-id="signInSubmitButton"]') || passwords === 1) return 'sign-in';
  return null;
}

export function fillAccount(doc: Document, email: string, password: string): { filled: number; page: 'create' | 'sign-in' | null } {
  const boxes = [...doc.querySelectorAll<HTMLInputElement>('input[type="password"]')].filter((b) => !isHidden(b) && !b.disabled);
  const page = pageOf(doc, boxes.length);
  if (!page || !password) return { filled: 0, page: null };
  let filled = 0;
  const mail = [...doc.querySelectorAll<HTMLInputElement>('input[type="email"], [data-automation-id="email"], input[autocomplete="email"], input[name*="email" i]')]
    .find((b) => !isHidden(b) && !b.disabled);
  if (mail && email && !mail.value) {
    setNativeValue(mail, email);
    filled++;
  }
  // The password, and its confirmation on a page that creates an account.
  for (const b of boxes.slice(0, page === 'create' ? 2 : 1)) {
    setNativeValue(b, password);
    filled++;
  }
  return { filled, page };
}
