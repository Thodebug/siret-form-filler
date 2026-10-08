// Builds one folder and one zip per browser family in dist/.
//
// The code is copied untouched; only manifest.json differs:
//   - Firefox: "menus" permission, background.scripts, gecko settings.
//   - Chromium (Chrome, Edge): "contextMenus" permission,
//     background.service_worker, minimum_chrome_version.
// Usage: npm run build
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const sourceDir = `${rootDir}extension`;
const distDir = `${rootDir}dist`;
const source = JSON.parse(readFileSync(`${sourceDir}/manifest.json`, 'utf8'));

/**
 * @param {Record<string, unknown>} manifest
 * @param {string[]} keys
 */
function without(manifest, keys) {
  return Object.fromEntries(Object.entries(manifest).filter(([key]) => !keys.includes(key)));
}

const targets = {
  firefox: {
    ...without(source, ['minimum_chrome_version']),
    permissions: ['menus'],
    background: { scripts: source.background.scripts },
  },
  chromium: {
    ...without(source, ['browser_specific_settings']),
    permissions: ['contextMenus'],
    background: { service_worker: source.background.service_worker },
  },
};

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir);

for (const [target, manifest] of Object.entries(targets)) {
  const targetDir = `${distDir}/${target}`;
  cpSync(sourceDir, targetDir, { recursive: true });
  writeFileSync(`${targetDir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  const filename = `siret-form-filler-${target}-${source.version}.zip`;
  execFileSync(
    process.execPath,
    [
      `${rootDir}node_modules/web-ext/bin/web-ext.js`,
      'build',
      '--source-dir',
      targetDir,
      '--artifacts-dir',
      distDir,
      '--filename',
      filename,
      '--overwrite-dest',
    ],
    { stdio: 'inherit' },
  );
  console.log(`dist/${filename}`);
}
