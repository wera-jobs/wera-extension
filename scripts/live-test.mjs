// The nightly live test (#139): the built extension runs Autofill on fresh
// postings from public board APIs, as a test account on a Wera server that
// is not the live one, and nothing is ever sent to the sites: every non-GET
// request to them is aborted (uploads answered as if they went through),
// and Wera never presses Submit.
//
//   WERA_OPEN_SHADOW=1 npm run build   # a test build: the panel in an open shadow root
//   WERA_API=http://127.0.0.1:8092 WERA_EMAIL=... WERA_PASSWORD=... \
//     node scripts/live-test.mjs dist out/ > night.json
//
// Prints {"ran_on", "systems": [...]} for `wera live-test import`, and keeps
// each posting's fields in out/. The score is the share of required fields
// filled.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const [, , dist = 'dist', outDir = 'live-test-out'] = process.argv;
const API = process.env.WERA_API ?? '';
const EMAIL = process.env.WERA_EMAIL ?? '';
const PASSWORD = process.env.WERA_PASSWORD ?? '';
const PER_BOARD = Number(process.env.WERA_PER_BOARD ?? 2);
if (!API || !EMAIL || !PASSWORD || /wera-jobs\.com/.test(API)) {
  console.error('set WERA_API (not the live server), WERA_EMAIL and WERA_PASSWORD for a test account');
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

// Boards with public APIs, by system. Newest postings first.
const BOARDS = {
  Greenhouse: ['discord', 'figma', 'duolingo', 'databricks', 'robinhood'],
  Lever: ['palantir', 'spotify'],
  Ashby: ['ramp', 'notion', 'openai', 'linear'],
};
const getJSON = async (url) => {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
};
const FRESH = {
  Greenhouse: async (b) => (await getJSON(`https://boards-api.greenhouse.io/v1/boards/${b}/jobs`)).jobs
    .sort((x, y) => Date.parse(y.updated_at) - Date.parse(x.updated_at)).map((j) => `https://job-boards.greenhouse.io/${b}/jobs/${j.id}`),
  Lever: async (b) => (await getJSON(`https://api.lever.co/v0/postings/${b}?mode=json`))
    .sort((x, y) => y.createdAt - x.createdAt).map((j) => `${j.hostedUrl}/apply`),
  Ashby: async (b) => (await getJSON(`https://api.ashbyhq.com/posting-api/job-board/${b}`)).jobs
    .sort((x, y) => Date.parse(y.publishedAt) - Date.parse(x.publishedAt)).map((j) => `${j.jobUrl}/application`),
};
const postings = [];
for (const [system, boards] of Object.entries(BOARDS)) {
  for (const b of boards) {
    try {
      if (process.env.WERA_ONLY && !`${system}-${b}`.includes(process.env.WERA_ONLY)) continue;
      for (const url of (await FRESH[system](b)).slice(0, PER_BOARD)) postings.push({ system, name: `${system}-${b}`, url });
    } catch (e) {
      console.error(`skipped ${system} ${b}: ${e.message}`);
    }
  }
}

const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true, viewport: { width: 1440, height: 900 },
  // A Chromium build other than Playwright's own (`npx playwright install chromium` fetches that).
  ...(process.env.WERA_CHROMIUM ? { executablePath: process.env.WERA_CHROMIUM } : {}),
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
await ctx.route('**/*', async (route) => {
  const r = route.request();
  const u = r.url();
  const m = r.method();
  if (u.startsWith(API) || m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue();
  // GraphQL reads (Ashby loads its form this way); never a mutation.
  const body = r.postData() ?? '';
  if (/graphql/i.test(u) && !/mutation\s|"operationName"\s*:\s*"[^"]*(Submit|Create|Apply|Upload)/i.test(body)) return route.continue();
  // Address and search lookups read; they send nothing of the applicant's.
  if (/address|places|autocomplete|suggest|search|typeahead|location/i.test(u)) return route.continue();
  if (/upload|s3|blob|file|resume|attachment|parse/i.test(u) || /multipart\/form-data/i.test(r.headers()['content-type'] ?? '')) return route.fulfill({ status: 204, body: '' });
  return route.abort();
});
const panel = (p) => p.locator('wera-panel');

async function signIn(url) {
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  const tab = panel(p).getByRole('button', { name: 'Show the Wera panel' });
  await tab.or(panel(p).getByRole('dialog', { name: 'Wera' })).first().waitFor({ timeout: 30000 });
  if (await tab.isVisible()) await tab.click();
  const other = panel(p).getByRole('button', { name: 'Use another Wera server' });
  await other.waitFor({ timeout: 20000 });
  await other.click();
  await panel(p).locator('input').first().fill(API);
  const withPassword = panel(p).getByRole('button', { name: /sign in here with your password/i });
  if (await withPassword.isVisible().catch(() => false)) await withPassword.click();
  await panel(p).getByLabel('Email').fill(EMAIL);
  await panel(p).getByLabel('Password').fill(PASSWORD);
  await panel(p).getByRole('button', { name: /Connect|Sign in/ }).click();
  await panel(p).getByRole('button', { name: /Autofill|Apply with Wera|Save to Wera|Fill again/ }).first().waitFor({ timeout: 30000 });
  await p.close();
}

// The fields a person can see in a frame: required or not, filled or not (radio and checkbox groups count once).
const READ = () => {
  const seen = (e) => {
    const r = e.getBoundingClientRect();
    return (r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden') || e.type === 'file';
  };
  const groups = new Map();
  for (const e of document.querySelectorAll('input,select,textarea')) {
    if (['hidden', 'submit', 'button', 'search', 'image', 'reset'].includes(e.type) || e.closest('wera-panel,wera-assist')) continue;
    if (!seen(e) && e.type !== 'radio' && e.type !== 'checkbox') continue;
    const key = (e.type === 'radio' || e.type === 'checkbox') && e.name ? `g:${e.name}` : `f:${groups.size}`;
    const required = e.required || e.getAttribute('aria-required') === 'true';
    // A dropdown's search box (react-select and the like) stays empty: its choice shows beside it.
    // Filled when the control shows text and no placeholder ("Select...").
    const shown = () => {
      if (e.getAttribute('role') !== 'combobox' && !e.closest('[class*="select" i]')) return false;
      const box = e.closest('[class*="control" i]') ?? e.parentElement?.parentElement;
      return !!box?.textContent?.trim() && !box.querySelector('[class*="placeholder" i]');
    };
    const filled = e.tagName === 'SELECT' ? !!e.value : e.type === 'radio' || e.type === 'checkbox' ? e.checked : e.type === 'file' ? (e.files?.length ?? 0) > 0 : !!e.value.trim() || shown();
    const label = (e.labels?.[0]?.textContent ?? e.getAttribute('aria-label') ?? e.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const g = groups.get(key) ?? { kind: e.type || e.tagName.toLowerCase(), label, required: false, filled: false };
    groups.set(key, { ...g, required: g.required || required, filled: g.filled || filled });
  }
  return [...groups.values()];
};

const runs = [];
if (postings.length) await signIn(postings[0].url);
for (const job of postings) {
  const p = await ctx.newPage();
  const run = { ...job, ok: false, fields: [] };
  try {
    await p.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForTimeout(4000);
    const tab = panel(p).getByRole('button', { name: 'Show the Wera panel' });
    if (await tab.isVisible().catch(() => false)) await tab.click();
    const go = panel(p).getByRole('button', { name: /^(Autofill|Apply with Wera)/ }).first();
    await go.waitFor({ timeout: 25000 });
    const t0 = Date.now();
    await go.click();
    await panel(p).getByRole('button', { name: /Fill again/ }).waitFor({ timeout: 150000 });
    run.ms = Date.now() - t0;
    await p.waitForTimeout(2500);
    for (const f of p.frames()) run.fields.push(...(await f.evaluate(READ).catch(() => [])));
    run.ok = true;
    await p.screenshot({ path: `${outDir}/${job.name}-${runs.length}.png`, fullPage: true }).catch(() => {});
  } catch (e) {
    run.error = String(e).slice(0, 300);
    run.panel = (await panel(p).innerText().catch(() => '')).slice(0, 2000);
    await p.screenshot({ path: `${outDir}/${job.name}-${runs.length}-failed.png` }).catch(() => {});
  }
  writeFileSync(`${outDir}/${job.name}-${runs.length}.json`, JSON.stringify(run, null, 1));
  console.error(`${job.name} ${run.ok ? `${run.fields.filter((f) => f.filled).length}/${run.fields.length} filled in ${run.ms} ms` : `failed: ${run.error?.slice(0, 100)}`}`);
  runs.push(run);
  await p.close();
}
await ctx.close();

const systems = Object.keys(BOARDS).map((system) => {
  const mine = runs.filter((r) => r.system === system);
  const fields = mine.flatMap((r) => r.fields);
  const required = fields.filter((f) => f.required);
  return {
    system, postings: mine.length, failed: mine.filter((r) => !r.ok).length,
    fields: fields.length, filled: fields.filter((f) => f.filled).length,
    // A posting that failed to fill counts as none of its required fields filled: at least one.
    required: required.length + mine.filter((r) => !r.ok).length,
    required_filled: required.filter((f) => f.filled).length,
  };
}).filter((s) => s.postings > 0);
console.log(JSON.stringify({ ran_on: new Date().toISOString().slice(0, 10), systems }));
