import { useState, type FormEvent } from 'react';
import { rpc } from '../shared/rpc';
import { describeError } from '../shared/errors';
import { Button, Field, INPUT, Notice } from './ui';
import { LogoMark } from './Logo';

export const DEFAULT_SERVER = 'https://www.wera-jobs.com';

/** Connects this browser to the user's Wera (the background signs in and keeps the key). */
export function SignIn({ onSignedIn, forJob }: { onSignedIn: () => void; forJob?: boolean }) {
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  // Almost everyone uses wera-jobs.com: another server is one click away, not a field to read past.
  const [otherServer, setOtherServer] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await rpc({ type: 'wera:sign-in', server, email, password });
      onSignedIn();
    } catch (err) {
      setError(describeError(err, "Couldn't connect to Wera"));
    } finally {
      setBusy(false);
    }
  };

  const site = /^https?:\/\//.test(server) ? server.replace(/\/+$/, '') : DEFAULT_SERVER;
  return (
    <div className={forJob ? 'space-y-3.5 rounded-card border border-border bg-surface p-3.5' : 'space-y-4 px-1 py-2'}>
      {forJob ? (
        // Under the job this page holds: say what signing in adds to it.
        <div className="space-y-1">
          <h2 className="text-sm font-semibold tracking-tight">Sign in to see your fit and autofill</h2>
          <p className="text-xs text-muted">Wera scores this job against your resume, fills the application and keeps your tracker current. You review and submit.</p>
        </div>
      ) : (
        <div className="space-y-1.5 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-accent/10"><LogoMark size={26} /></span>
          <h2 className="text-[15px] font-semibold tracking-tight">Sign in to Wera</h2>
          <p className="text-xs text-muted">See your fit on every job, autofill applications and keep your tracker current. You review and submit.</p>
        </div>
      )}
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        {otherServer && (
          <Field label="Wera address">
            <input className={INPUT} value={server} onChange={(e) => setServer(e.target.value)} required autoFocus />
          </Field>
        )}
        <Field label="Email">
          <input className={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </Field>
        <Field label="Password">
          <input className={INPUT} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </Field>
        {error && <Notice tone="bad">{error}</Notice>}
        <Button type="submit" variant="primary" busy={busy} className="w-full py-2.5">Connect</Button>
      </form>
      <div className="flex items-center justify-between text-[11px]">
        <a href={`${site}/forgot-password`} target="_blank" rel="noreferrer" className="text-muted hover:text-text hover:underline">Forgot password?</a>
        <a href={`${site}/signup`} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">Create an account</a>
      </div>
      <p className="border-t border-border pt-3 text-[11px] text-faint">
        This browser gets its own key; disconnect it any time in Wera's Settings.{' '}
        {!otherServer && <button type="button" className="text-muted underline-offset-2 hover:text-text hover:underline" onClick={() => setOtherServer(true)}>Use another Wera server</button>}
      </p>
    </div>
  );
}
