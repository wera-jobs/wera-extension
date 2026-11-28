// The service worker. It puts the Wera panel on job pages and does what
// the panel cannot from inside a page: calls the user's Wera server and
// reaches the page's other frames. The toolbar icon and Alt+Shift+W show
// or hide the panel; Alt+Shift+F (or the right-click menu) fills the form.
// It also keeps the dashboard bridge: which job the dashboard opened in a tab.
import { expectHandoff, syncBridge, takeHandoff } from '../shared/bridge';
import { markApplying, passApplying } from '../shared/flow';
import { isJobRequest } from '../shared/jobs';
import { log } from '../shared/log';
import { isPanelRequest } from '../shared/rpc';
import { addToQueue, passQueueTab } from '../shared/queue';
import { cleanRules, RULES_EVERY_MS, RULES_KEY } from '../shared/remoteRules';
import { DEFAULT_SERVER, forgetTab, loadSession, passTabJob, pendingServer } from '../shared/storage';
import { acceptDashboardKey } from './connect';
import type { ContentEvent } from '../shared/types';
import { clearBadgeCache, handleJobRequest } from './jobs';
import { clearProfileCache } from '../shared/profileCache';
import { frameField } from './frames';
import { ensurePanel, handlePanel } from './panel';
import { pumpQueue, queueTabClosed, watchQueue } from './queue';

chrome.runtime.onInstalled.addListener(() => {
  // An update keeps the old menu: recreating it with the same id would fail.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'wera-fill', title: 'Fill this application with Wera', contexts: ['page', 'editable'] }, () => void chrome.runtime.lastError);
  });
  // Older installs registered the Wera button per site, and could hide Wera on a site for a week.
  void chrome.scripting.unregisterContentScripts({ ids: ['wera-launcher'] }).catch(() => {});
  void chrome.storage.local.remove('wera.launcherDismissed').catch(() => {});
  void syncAll();
  void refreshRules(true);
});

chrome.runtime.onStartup.addListener(() => {
  void syncAll();
  void refreshRules();
});

/** Fetches the site rules from the user's Wera (#143) when the kept copy is over an hour old. */
async function refreshRules(force = false): Promise<void> {
  const got: Record<string, unknown> = await chrome.storage.local.get(RULES_KEY).catch(() => ({}));
  const kept = got[RULES_KEY] as { at?: number } | undefined;
  if (!force && kept?.at && Date.now() - kept.at < RULES_EVERY_MS) return;
  const s = await loadSession().catch(() => null);
  try {
    const res = await fetch(`${s?.server ?? DEFAULT_SERVER}/api/ext/rules`, { credentials: 'omit' });
    if (!res.ok) return;
    const rules = cleanRules(await res.json());
    if (rules) await chrome.storage.local.set({ [RULES_KEY]: { at: Date.now(), rules } });
  } catch {
    // offline or an older server: keep what is there
  }
}
chrome.tabs.onRemoved.addListener((tabId) => {
  void forgetTab(tabId).catch(() => {});
  void queueTabClosed(tabId).catch(() => {});
});
watchQueue();
void pumpQueue();

// The queue's Review button: bring that application's tab forward.
chrome.runtime.onMessage.addListener((msg: { type?: string; tabId?: unknown }, sender) => {
  if (msg?.type !== 'wera:queue-focus' || sender.id !== chrome.runtime.id || typeof msg.tabId !== 'number') return false;
  const tabId = msg.tabId;
  void chrome.tabs.update(tabId, { active: true }).then((t) => (t?.windowId != null ? chrome.windows.update(t.windowId, { focused: true }) : undefined)).catch(() => {});
  return false;
});

// The panel (a page script) keeps where a multi-page application is in session storage.
void chrome.storage.session.setAccessLevel?.({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch(() => {});

let syncing: Promise<void> = Promise.resolve();

/**
 * The dashboard bridge on the user's server. Runs one at a time: signing
 * in fires several events at once, and overlapping runs could unregister
 * what another just registered.
 */
function syncAll(): Promise<void> {
  syncing = syncing.then(async () => {
    const s = await loadSession();
    // Signed out, the bridge waits on the default server, whose dashboard can connect the extension.
    await syncBridge(s?.server ?? DEFAULT_SERVER, s ? null : await pendingServer());
  }).catch(() => {});
  return syncing;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['wera.session']) void syncAll();
});

/** Shows or hides the panel on the tab's page; on a page Wera cannot run on, opens the dashboard. */
async function toggle(tab: chrome.tabs.Tab | undefined, fill = false) {
  if (tab?.id == null) return;
  if (!/^https?:/.test(tab.url ?? '')) {
    const s = await loadSession();
    if (s) void chrome.tabs.create({ url: `${s.server}/` });
    return;
  }
  const shown = fill ? null : await chrome.tabs.sendMessage<{ type: string }, boolean>(tab.id, { type: 'wera:panel-toggle' }, { frameId: 0 }).catch(() => null);
  if (!shown) await ensurePanel(tab.id, { open: true, fill });
}

chrome.action.onClicked.addListener((tab) => void toggle(tab));
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'wera-fill') void toggle(tab, true);
});
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'toggle-panel') void toggle(tab);
  if (command === 'fill-form') void toggle(tab, true);
});

chrome.runtime.onMessage.addListener((msg: unknown, sender, reply) => {
  if (sender.id !== chrome.runtime.id || sender.tab?.id == null) return false;
  const tabId = sender.tab.id;
  // The lightweight detector found a candidate job page: load the full page engine in that frame.
  if (msg && typeof msg === 'object' && (msg as { type?: unknown }).type === 'wera:wake') {
    void refreshRules();
    const frameId = sender.frameId ?? 0;
    void chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: ['page.js'] }).catch(() => {});
    return false;
  }
  if (isPanelRequest(msg)) {
    handlePanel(msg, tabId, sender.frameId ?? 0).then(reply, (e: unknown) => {
      log.error('background', `${msg.type} failed`, e);
      reply({ ok: false, status: 0, error: e instanceof Error ? e.message : String(e) });
    });
    return true; // async reply
  }
  if (isJobRequest(msg)) {
    handleJobRequest(msg, tabId, sender.tab.url ?? '', sender.frameId ?? 0).then(reply, (e: unknown) => {
      log.warn('background', `${msg.type} failed`, e);
      reply(null);
    });
    return true;
  }
  // What a frame's page script noticed (a new form step, a field filled, a confirmation): the panel hears it.
  const e = msg as ContentEvent | null;
  if (e?.type === 'wera:form-changed' || e?.type === 'wera:fill-progress' || e?.type === 'wera:field-changed' || e?.type === 'wera:submitted' || e?.type === 'wera:navigated') {
    const frameId = sender.frameId ?? 0;
    const event = e.type === 'wera:fill-progress'
      ? { ...e, result: { ...e.result, id: frameField(frameId, e.result.id) } }
      : e.type === 'wera:field-changed'
        ? { ...e, id: frameField(frameId, e.id) }
        : e;
    void chrome.tabs.sendMessage(tabId, { type: 'wera:frame-event', frameId, event }, { frameId: 0 }).catch(() => {});
  }
  return false;
});

// The dashboard's connect page hands over a key for the account signed in there: no password in the panel.
chrome.runtime.onMessage.addListener((msg: { type?: string; token?: unknown }, sender, reply) => {
  if (msg?.type !== 'wera:dashboard-connect' || sender.tab?.id == null) return false;
  const from = sender.origin ?? (sender.url ? new URL(sender.url).origin : '');
  void acceptDashboardKey(from, msg.token).then((ok) => reply({ ok }));
  return true;
});

// The user changed their details, answers or resumes in the dashboard: the next Autofill reads them fresh.
chrome.runtime.onMessage.addListener((msg: { type?: string }, sender) => {
  if (msg?.type !== 'wera:dashboard-changed') return false;
  void loadSession().then((s) => {
    const from = sender.origin ?? (sender.url ? new URL(sender.url).origin : '');
    if (!s || from !== s.server) return; // only the user's own Wera
    void clearProfileCache();
    clearBadgeCache();
  });
  return false;
});

// "Queue in the extension" in the dashboard: line the jobs up in the application queue.
chrome.runtime.onMessage.addListener((msg: { type?: string; jobs?: unknown }, sender) => {
  if (msg?.type !== 'wera:dashboard-queue' || sender.tab?.id == null || !Array.isArray(msg.jobs)) return false;
  const jobs = msg.jobs as unknown[];
  void loadSession().then(async (s) => {
    const from = sender.origin ?? (sender.url ? new URL(sender.url).origin : '');
    if (!s || from !== s.server) return; // only the user's own Wera
    for (const j of jobs.slice(0, 30)) {
      const { jobId, url, title, company } = (j ?? {}) as Record<string, unknown>;
      if (typeof jobId !== 'number' || typeof url !== 'string' || !/^https?:\/\//.test(url) || typeof title !== 'string' || typeof company !== 'string') continue;
      await addToQueue({ jobId, url, title: title.slice(0, 200), company: company.slice(0, 200) });
    }
  });
  return false;
});

// "Apply on Acme's site" in the dashboard: remember the job, then tie it to the tab that click opens.
chrome.runtime.onMessage.addListener((msg: { type?: string; jobId?: unknown; url?: unknown }, sender) => {
  if (msg?.type !== 'wera:dashboard-open-job' || sender.tab?.id == null) return false;
  void loadSession().then((s) => {
    const from = sender.origin ?? (sender.url ? new URL(sender.url).origin : '');
    if (!s || from !== s.server) return; // only the user's own Wera
    if (typeof msg.jobId !== 'number' || typeof msg.url !== 'string' || !/^https?:\/\//.test(msg.url)) return;
    void expectHandoff(sender.tab!.id!, msg.jobId, msg.url);
  });
  return false;
});

chrome.tabs.onCreated.addListener((tab) => {
  const id = tab.id;
  if (id == null) return;
  // "Apply on the company's site" in the dashboard: the user is applying, so the application fills itself.
  void takeHandoff(tab).then((handed) => (handed ? markApplying(id) : undefined)).catch(() => {});
  if (tab.openerTabId != null) {
    void passApplying(tab.openerTabId, id).catch(() => {});
    void passTabJob(tab.openerTabId, id).catch(() => {});
    void passQueueTab(tab.openerTabId, id).catch(() => {});
  }
});
