// The panel's settings: what Wera does on its own, the Debug log, and
// signing out.
import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ExternalLink } from 'lucide-react';
import { rpc } from '../shared/rpc';
import { isSiteHidden, setSiteHidden, siteKey } from '../shared/settings';
import type { PanelProps } from './Panel';
import { Button } from './ui';

/** One setting: what it does, and a switch. */
function Toggle({ label, hint, on, set }: { label: string; hint: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-text">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-faint">{hint}</span>
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={on} onChange={(e) => set(e.target.checked)} />
      <span aria-hidden className={clsx('relative mt-0.5 h-[18px] w-[30px] shrink-0 rounded-full ring-1 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
        on ? 'bg-accent ring-accent' : 'bg-surface-2 ring-border')}>
        <span className="absolute top-[2px] size-[14px] rounded-full bg-white shadow-sm transition-[left] duration-150" style={{ left: on ? 14 : 2 }} />
      </span>
    </label>
  );
}

/** A group of settings under a small heading. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="px-0.5 text-[10px] font-semibold tracking-wider text-faint uppercase">{title}</h3>
      <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">{children}</div>
    </section>
  );
}

/** Who this browser is signed in as. */
function useSignedInAs(): { name: string; email: string } | null {
  const [who, setWho] = useState<{ name: string; email: string } | null>(null);
  useEffect(() => {
    void chrome.storage.local.get('wera.session').then((g) => {
      const u = (g['wera.session'] as { user?: { name?: string; email?: string } } | undefined)?.user;
      if (u?.email) setWho({ name: u.name ?? '', email: u.email });
    }, () => {});
  }, []);
  return who;
}

export function SettingsView({ api, settings, setSettings, onSignedOut, onClose, onHideSite }: PanelProps & { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const who = useSignedInAs();
  const site = siteKey(document);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    void isSiteHidden(site).then(setHidden, () => {});
  }, [site]);
  const showHere = (show: boolean) => {
    setHidden(!show);
    void setSiteHidden(site, !show).catch(() => {});
    if (!show) onHideSite();
  };
  const signOut = async () => {
    setBusy(true);
    await rpc({ type: 'wera:sign-out' }).catch(() => null);
    setBusy(false);
    onSignedOut();
    onClose();
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Settings</h2>
        <Button className="ml-auto px-2.5 py-1" onClick={onClose}>Done</Button>
      </div>
      {api && (
        <div className="flex items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">{(who?.name || who?.email || 'W')[0]!.toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{who?.name || 'Signed in'}</p>
            {who?.email && <p className="truncate text-[11px] text-faint">{who.email}</p>}
          </div>
          <a href={api.dashboardUrl('/')} target="_blank" rel="noreferrer" title="Open the Wera dashboard" className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"><ExternalLink className="size-3.5" /></a>
          <Button variant="ghost" className="px-2 py-1" onClick={() => void signOut()} busy={busy}>Sign out</Button>
        </div>
      )}
      <Group title="Filling">
        <Toggle label="Answer with AI" hint="Fields your details do not cover, from your profile and resume. Unsure answers wait for you." on={settings.aiSuggest} set={(v) => setSettings({ aiSuggest: v })} />
        <Toggle label="Draft open questions and cover letters" hint={'"Why us?", "Tell me about a time...", and a letter when the form asks for one: drafted for you to read.'} on={settings.aiQuestions} set={(v) => setSettings({ aiQuestions: v })} />
        <Toggle label="Wera button in open questions" hint="Draft, rework and insert an answer right in the box." on={settings.assist} set={(v) => setSettings({ assist: v })} />
        <Toggle label="Keep filling multi-page applications" hint="Each new step fills itself once Wera has filled the first." on={settings.autoContinue} set={(v) => setSettings({ autoContinue: v })} />
        <Toggle label="Remember my answers" hint="What you type into forms, for the next application." on={settings.learn} set={(v) => setSettings({ learn: v })} />
      </Group>
      <Group title="After you apply">
        <Toggle label="Mark applied when the site confirms" hint={'"Thank you for applying" moves the job to Applied.'} on={settings.autoApplied} set={(v) => setSettings({ autoApplied: v })} />
        <Toggle label="Close the tab after applying" hint="Once the site confirms, Wera says so, then closes the tab." on={settings.closeAfterApply} set={(v) => setSettings({ closeAfterApply: v })} />
      </Group>
      <Group title="Where Wera shows">
        <Toggle label="On job pages" hint="Off: open it from the toolbar icon (Alt+Shift+W)." on={settings.launcher} set={(v) => setSettings({ launcher: v })} />
        <Toggle label={`On ${site}`} hint="Off: Wera stays away from this site. The toolbar icon still opens it here." on={!hidden} set={showHere} />
      </Group>
      <Group title="Troubleshooting">
        <Toggle label="Debug log" hint="Writes what Wera reads and fills to the page's console ([wera:…] lines), to find out why a field was missed." on={settings.debug} set={(v) => setSettings({ debug: v })} />
      </Group>
    </div>
  );
}
