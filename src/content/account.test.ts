import { describe, expect, it } from 'vitest';
import { strongPassword } from '../background/vault';
import { WORKDAY_ACCOUNT } from './__fixtures__/workday';
import { fillAccount } from './account';

describe('job-site accounts (Workday)', () => {
  it('fills the email, the password and its confirmation on Create Account, and presses nothing', () => {
    document.body.innerHTML = WORKDAY_ACCOUNT.replace('<button', '<div><label for="vp">Verify New Password</label><input id="vp" type="password" data-automation-id="verifyPassword"></div><button');
    let pressed = false;
    document.querySelector('button')!.addEventListener('click', () => (pressed = true));
    expect(fillAccount(document, 'ada@example.com', 'S3cure!pass')).toEqual({ filled: 3, page: 'create' });
    expect((document.querySelector('#em') as HTMLInputElement).value).toBe('ada@example.com');
    expect([...document.querySelectorAll<HTMLInputElement>('input[type=password]')].map((b) => b.value)).toEqual(['S3cure!pass', 'S3cure!pass']);
    expect(pressed).toBe(false);
  });

  it('signs in with the same password, and does nothing without one', () => {
    document.body.innerHTML = '<div><label for="e">Email Address</label><input id="e" type="email"><label for="p">Password</label><input id="p" type="password"><button data-automation-id="signInSubmitButton">Sign In</button></div>';
    expect(fillAccount(document, 'ada@example.com', '')).toEqual({ filled: 0, page: null });
    expect(fillAccount(document, 'ada@example.com', 'S3cure!pass')).toEqual({ filled: 2, page: 'sign-in' });
  });

  it('makes strong passwords job sites accept', () => {
    const p = strongPassword();
    expect(p).toHaveLength(16);
    expect(p).toMatch(/[A-Z]/);
    expect(p).toMatch(/[a-z]/);
    expect(p).toMatch(/\d/);
    expect(p).toMatch(/[!@#$%&*?]/);
    expect(strongPassword()).not.toBe(p);
  });
});
