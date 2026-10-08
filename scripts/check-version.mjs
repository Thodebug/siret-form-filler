// Checks that package.json, the manifest and (optionally) a release tag agree.
// Usage: node scripts/check-version.mjs [vX.Y.Z]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const packageVersion = JSON.parse(readFileSync(`${rootDir}package.json`, 'utf8')).version;
const manifestVersion = JSON.parse(
  readFileSync(`${rootDir}extension/manifest.json`, 'utf8'),
).version;
const tag = process.argv[2];

const errors = [];
if (!/^\d+\.\d+\.\d+$/.test(manifestVersion)) {
  errors.push(`manifest version "${manifestVersion}" is not X.Y.Z`);
}
if (packageVersion !== manifestVersion) {
  errors.push(`package.json (${packageVersion}) and manifest (${manifestVersion}) differ`);
}
if (tag && tag !== `v${manifestVersion}`) {
  errors.push(`tag ${tag} does not match manifest version ${manifestVersion}`);
}
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`version ${manifestVersion} OK`);
