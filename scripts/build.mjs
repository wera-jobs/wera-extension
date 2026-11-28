// Builds the extension into dist/: the four Vite targets plus the
// manifest (with the version from package.json) and icons.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { build } from 'vite';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

for (const target of ['background', 'detector', 'page', 'panel', 'bridge', 'submitWatch']) {
  process.env.WERA_TARGET = target;
  await build({ configFile: 'vite.config.ts', mode: watch ? 'development' : 'production', build: { watch: watch ? {} : null } });
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
manifest.version = pkg.version;
// End-to-end tests cannot click permission prompts: their build has the
// local test servers granted up front. Never set this for a release.
if (process.env.WERA_E2E) manifest.host_permissions = ['http://127.0.0.1/*', 'http://localhost/*'];
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
cpSync('public', 'dist', { recursive: true });
// Geist for what Wera draws on job pages (the panel and the answer button).
mkdirSync('dist/fonts', { recursive: true });
cpSync('node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2', 'dist/fonts/geist.woff2');
cpSync('node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2', 'dist/fonts/geist-mono.woff2');
console.log(`built wera-extension ${pkg.version} into dist/`);

// Firefox (npm run build:firefox): the same code, with what Firefox's MV3 wants instead.
if (process.argv.includes('--firefox')) {
  rmSync('dist-firefox', { recursive: true, force: true });
  cpSync('dist', 'dist-firefox', { recursive: true });
  const ff = { ...manifest };
  // Firefox runs MV3 backgrounds as event pages, not service workers.
  ff.background = { scripts: ['background.js'], type: 'module' };
  delete ff.minimum_chrome_version;
  ff.browser_specific_settings = { gecko: { id: 'wera@wera-jobs.com', strict_min_version: '128.0' } };
  writeFileSync('dist-firefox/manifest.json', JSON.stringify(ff, null, 2));
  console.log(`built wera-extension ${pkg.version} for Firefox into dist-firefox/`);
}
