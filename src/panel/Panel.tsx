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
import { Badge, Fit, JobCard, Posting, QuickMatch, Submitted } from './JobViews';
import { PostingFacts } from './PostingFacts';
import { Referrals } from './Referrals';
import { Launcher } from './Launcher';
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
}

export function Panel(props: PanelProps) {
  const { api, page, open, onOpen } = props;
  const [menu, setMenu] = useState(false);
  const kind = page.info?.hasForm ? 'form' : page.handle.kind;

  // Collapsed: Wera's mark on a tab at the right edge, which the user can move up and down.
  if (!open) return <Launcher onOpen={() => onOpen(true)} />;
  return (
    <section role="dialog" aria-label="Wera"
      className="anim-slide panel-shadow fixed top-3 right-3 bottom-3 z-[2147483646] flex w-[372px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-card border border-border bg-bg">
      <header className="flex items-center gap-2 border-b border-border bg-surface px-3.5 py-2.5">
        <LogoMark size={20} />
        <span className="font-mono text-[15px] font-semibold tracking-tight">wera</span>
        {kind && <Badge className="border-border bg-surface-2 text-muted">{kind === 'form' ? 'Application' : 'Job posting'}</Badge>}
        <button type="button" className={clsx('ml-auto grid size-7 place-items-center rounded-lg hover:bg-surface-2', menu ? 'text-accent' : 'text-faint hover:text-text')}
          onClick={() => setMenu((m) => !m)} aria-label="Settings" aria-pressed={menu}>
          <Settings2 className="size-4" />
        </button>
        <button type="button" className="grid size-7 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-text" onClick={() => onOpen(false)} aria-label="Collapse the Wera panel" title="Collapse">
          <ChevronRight className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5">
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
      <JobCard api={api} page={page} />
      {!page.loading && <PostingFacts job={page.job} draft={page.info?.draft ?? page.handle.draft} text={page.info?.text ?? ''} />}
      {page.job ? <Fit api={api} page={page} /> : !page.loading && <QuickMatch api={api} page={page} />}
      {page.error && <Notice tone="bad">{page.error}</Notice>}
      {kind === 'form' ? <Apply {...props} /> : <Posting api={api} page={page} tabId={props.tabId} />}
      {!page.loading && !page.submitted && (
        <Referrals api={api} jobId={page.job?.id ?? null}
          company={page.job?.company || page.info?.draft?.company || page.handle.company || ''}
          title={page.job?.title || page.info?.draft?.title || page.handle.title || ''}
          description={page.info?.draft?.description || page.info?.text || ''} />
      )}
    </>
  );
}
