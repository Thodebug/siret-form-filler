import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

export const rootDir = fileURLToPath(new URL('..', import.meta.url));

/** Content scripts shared by the tests, in manifest order. */
const LIBRARY_SCRIPTS = ['numbers.js', 'detection.js', 'fill.js'];

/**
 * @param {string} relativePath
 * @returns {string}
 */
export function readProjectFile(relativePath) {
  return readFileSync(`${rootDir}${relativePath}`, 'utf8');
}

/**
 * Builds a jsdom window with the extension libraries loaded, as they are in
 * a content script.
 * @param {string} html
 * @returns {{ window: import('jsdom').DOMWindow, sff: Required<SiretFormFillerNamespace> }}
 */
export function loadPage(html) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.test/' });
  for (const script of LIBRARY_SCRIPTS) {
    dom.window.eval(readProjectFile(`extension/content/${script}`));
  }
  return { window: dom.window, sff: dom.window.SiretFormFiller };
}

/** Maps the data-expected attribute of fixtures to a detection kind. */
export const EXPECTED_KIND = { 14: 'siret', 9: 'siren', 0: null };
