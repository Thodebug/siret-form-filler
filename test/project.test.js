import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { readProjectFile, rootDir } from './helpers.js';

const manifest = JSON.parse(readProjectFile('extension/manifest.json'));
const packageJson = JSON.parse(readProjectFile('package.json'));
const messages = JSON.parse(readProjectFile('extension/_locales/fr/messages.json'));

describe('manifest', () => {
  it('has the same version as package.json', () => {
    assert.equal(manifest.version, packageJson.version);
  });

  it('references existing locale messages', () => {
    const fromManifest = [...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map(
      (match) => match[1],
    );
    const fromBackground = [
      ...readProjectFile('extension/background/background.js').matchAll(/'(menuSire[nt])'/g),
    ].map((match) => match[1]);
    for (const key of [...fromManifest, ...fromBackground]) {
      assert.ok(messages[key], `missing message ${key}`);
    }
  });

  it('keeps the description within the Chrome Web Store limit of 132 characters', () => {
    assert.ok(messages.extDescription.message.length <= 132);
  });

  it('points to existing scripts and icons', () => {
    const files = [
      ...manifest.content_scripts.flatMap((/** @type {{ js: string[] }} */ entry) => entry.js),
      ...manifest.background.scripts,
      manifest.background.service_worker,
      ...Object.values(manifest.icons),
    ];
    for (const file of files) {
      assert.ok(existsSync(`${rootDir}extension/${file}`), `missing ${file}`);
    }
  });

  it('ships icons at their declared size', () => {
    for (const [size, file] of Object.entries(manifest.icons)) {
      const png = readFileSync(`${rootDir}extension/${file}`);
      assert.equal(png.readUInt32BE(16), Number(size), `${file} width`);
      assert.equal(png.readUInt32BE(20), Number(size), `${file} height`);
    }
  });

  it('declares that no data is collected', () => {
    assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions, {
      required: ['none'],
    });
  });
});

describe('repository text', () => {
  const FORBIDDEN = [0x2014, 0x2013, 0x00b7].map((code) => String.fromCharCode(code));
  const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist']);
  const TEXT_EXTENSIONS = /\.(js|mjs|json|md|html|css|svg|yml|yaml|txt|d\.ts)$|^(LICENSE|\.\w+)$/;

  /**
   * @param {string} directory
   * @returns {string[]}
   */
  function listTextFiles(directory) {
    /** @type {string[]} */
    const files = [];
    for (const name of readdirSync(directory)) {
      const path = `${directory}/${name}`;
      if (statSync(path).isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(name)) {
          files.push(...listTextFiles(path));
        }
      } else if (TEXT_EXTENSIONS.test(name)) {
        files.push(path);
      }
    }
    return files;
  }

  it('never uses em dashes, en dashes or middle dots', () => {
    for (const file of listTextFiles(rootDir.replace(/\/$/, ''))) {
      const content = readFileSync(file, 'utf8');
      for (const char of FORBIDDEN) {
        assert.ok(
          !content.includes(char),
          `${file} contains U+${char.charCodeAt(0).toString(16).toUpperCase()}`,
        );
      }
    }
  });
});
