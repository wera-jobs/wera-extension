// The Wera panel on a job page: one card at the right edge (a tab with
// Wera's mark once collapsed). On an application it has one big Autofill
// button and, after filling, only what still needs the user; on a
// posting, the job's fit and Save. Resume and cover letter sit under it.
// Deeper work (editing the resume, details, the letter) opens in the
// dashboard. The views live in Apply.tsx, JobViews.tsx and SettingsView.tsx.
import { useState } from 'react';
import clsx from 'clsx';
import { ChevronRight, Settings2 } from 'lucide-react';
import type { WeraApi } from '../shared/api';
import type { Settings } from '../shared/settings';
import { Apply } from './Apply';
import { Fit, Posting, QuickMatch, Submitted } from './JobViews';
import { JobHeader } from './JobHeader';
import { Referrals } from './Referrals';
import { Launcher, type HideChoice } from './Launcher';
import { setSiteHidden, siteKey } from '../shared/settings';
import { LogoMark } from './Logo';
import { SettingsView } from './SettingsView';
import { SignIn } from './SignIn';
import { Notice } from './ui';
import type { PanelPageState } from './usePanelPage';

export { rowLabel } from './rows';

export interface PanelProps {
  api: WeraApi | null;
  page: PanelPageState;
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
  tabId: number | null;
  open: boolean;
  onOpen: (open: boolean) => void;
  /** Asked to fill (toolbar shortcut, right-click menu) before the panel was ready. */
  fillRequest: number;
  onSignedIn: () => void;
  onSignedOut: () => void;
  /** The user turned Wera off on this site: it goes away now. */
  onHideSite: () => void;
  /** A wide window: the panel is a sidebar the page makes room for, flush with the edge (as Simplify's and Jobright's are). */
  docked?: boolean;
}

export function Panel(props: PanelProps) {
  const { api, page, open, onOpen } = props;
  const [menu, setMenu] = useState(false);
  const kind = page.info?.hasForm ? 'form' : page.handle.kind;

  // Collapsed: Wera's mark on a tab at the right edge, which the user can move up and down.
  if (!open) {
    const hide = (how: HideChoice) => {
      // Until the next visit: gone from this page. On this site, or everywhere: remembered.
      if (how === 'site') void setSiteHidden(siteKey(document), true).catch(() => {});
      if (how === 'everywhere') props.setSettings({ launcher: false });
      props.onHideSite();
    };
    return <Launcher onOpen={() => onOpen(true)} onHide={hide} />;
  }
  return (
    <section role="dialog" aria-label="Wera"
      className={clsx('anim-slide fixed z-[2147483646] flex flex-col overflow-hidden bg-bg',
        props.docked ? 'inset-y-0 right-0 w-[384px] border-l border-border shadow-[-8px_0_24px_-12px_rgb(0_0_0/0.25)]'
          : 'panel-shadow top-3 right-3 bottom-3 w-[372px] max-w-[calc(100vw-24px)] rounded-card border border-border')}>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-3.5">
        <LogoMark size={20} />
        <span className="font-mono text-[15px] font-semibold tracking-tight">wera</span>
        <button type="button" className={clsx('ml-auto grid size-8 place-items-center rounded-lg hover:bg-surface-2', menu ? 'bg-surface-2 text-accent' : 'text-muted hover:text-text')}
          onClick={() => setMenu((m) => !m)} aria-label="Settings" aria-pressed={menu} title="Settings">
          <Settings2 className="size-4" />
        </button>
        <button type="button" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text" onClick={() => onOpen(false)} aria-label="Collapse the Wera panel" title="Collapse (Alt+Shift+W)">
          <ChevronRight className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5 [scrollbar-width:thin]">
        {menu ? <SettingsView {...props} onClose={() => setMenu(false)} />
          : !api ? <SignIn onSignedIn={props.onSignedIn} />
          : <Main {...props} api={api} kind={kind} />}
      </div>
    </section>
  );
}

function Main(props: PanelProps & { api: WeraApi; kind: 'form' | 'posting' | null }) {
  const { api, page, kind } = props;
  return (
    <>
      {page.submitted && <Submitted api={api} page={page} />}
      <JobHeader api={api} page={page} kind={kind} />
      {page.error && <Notice tone="bad">{page.error}</Notice>}
      {kind === 'form' ? <Apply {...props} /> : <Posting api={api} page={page} tabId={props.tabId} />}
      {page.job ? <Fit api={api} page={page} /> : (page.info || !page.loading) && <QuickMatch api={api} page={page} />}
      {(page.info || !page.loading) && !page.submitted && (
        <Referrals api={api} jobId={page.job?.id ?? null}
          company={page.job?.company || page.info?.draft?.company || page.handle.company || ''}
          title={page.job?.title || page.info?.draft?.title || page.handle.title || ''}
          description={page.info?.draft?.description || page.info?.text || ''} />
      )}
    </>
  );
}
