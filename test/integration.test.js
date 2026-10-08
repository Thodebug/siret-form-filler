// Runs the real background and content scripts together against a fake
// extension API, for both the Firefox (menus.onShown) and the Chromium
// (verdict pushed before the menu opens) code paths.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { readProjectFile } from './helpers.js';
import { isValidSiret } from './validators.js';

const MENU_ID = 'sff-generate';
const messages = JSON.parse(readProjectFile('extension/_locales/fr/messages.json'));
const PAGE = `<form>
  <div><label for="siret">N° SIRET</label><input id="siret" value="old"></div>
  <div><label for="siren">SIREN</label><input id="siren"></div>
  <div><label for="vat">N° TVA</label><input id="vat"></div>
</form>`;

/** Lets pending promises and message handlers settle. */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * @param {{ firefox: boolean }} options
 */
function createEnvironment({ firefox }) {
  /** @type {Record<string, Function[]>} */
  const listeners = {
    installed: [],
    startup: [],
    background: [],
    content: [],
    clicked: [],
    shown: [],
    hidden: [],
  };
  /** @type {Map<string, Record<string, unknown>>} */
  const items = new Map();
  /** @type {Map<number, Element>} */
  const targets = new Map();
  const stats = { refreshes: 0 };

  /** @param {Function[]} list */
  const event = (list) => ({ addListener: (/** @type {Function} */ fn) => list.push(fn) });

  /** @type {Record<string, any>} */
  const menus = {
    create(/** @type {Record<string, unknown>} */ properties, /** @type {Function} */ callback) {
      items.set(String(properties.id), { ...properties });
      callback?.();
    },
    async update(/** @type {string} */ id, /** @type {Record<string, unknown>} */ properties) {
      const item = items.get(id);
      if (!item) {
        throw new Error(`Cannot find menu item with id ${id}`);
      }
      Object.assign(item, properties);
    },
    async removeAll() {
      items.clear();
    },
    onClicked: event(listeners.clicked),
  };
  if (firefox) {
    menus.onShown = event(listeners.shown);
    menus.onHidden = event(listeners.hidden);
    menus.refresh = async () => {
      stats.refreshes++;
    };
    menus.getTargetElement = (/** @type {number} */ id) => targets.get(id) ?? null;
  }

  const api = {
    [firefox ? 'menus' : 'contextMenus']: menus,
    i18n: { getMessage: (/** @type {string} */ name) => messages[name].message },
    runtime: {
      lastError: undefined,
      onInstalled: event(listeners.installed),
      onStartup: event(listeners.startup),
      onMessage: {
        addListener(/** @type {Function} */ fn) {
          // The background registers first, then the content script.
          (api.contentLoaded ? listeners.content : listeners.background).push(fn);
        },
      },
      async sendMessage(/** @type {unknown} */ message) {
        for (const fn of listeners.background) {
          fn(message, {}, () => {});
        }
      },
    },
    tabs: {
      sendMessage(
        /** @type {number} */ _tabId,
        /** @type {unknown} */ message,
        /** @type {{ frameId?: number }} */ _options,
      ) {
        return new Promise((resolve) => {
          for (const fn of listeners.content) {
            fn(message, {}, resolve);
          }
        });
      },
    },
    contentLoaded: false,
  };

  const backgroundContext = vm.createContext(firefox ? { browser: api } : { chrome: api });
  vm.runInContext(readProjectFile('extension/background/background.js'), backgroundContext);
  api.contentLoaded = true;

  const dom = new JSDOM(PAGE, { runScripts: 'outside-only', url: 'https://example.test/' });
  dom.window[firefox ? 'browser' : 'chrome'] = api;
  for (const script of ['numbers.js', 'detection.js', 'fill.js', 'content.js']) {
    dom.window.eval(readProjectFile(`extension/content/${script}`));
  }

  const document = dom.window.document;
  /** @param {string} id */
  const input = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));

  return {
    window: dom.window,
    input,
    listeners,
    targets,
    stats,
    menu: () => items.get(MENU_ID),
    async install() {
      for (const fn of listeners.installed) {
        fn();
      }
      await flush();
    },
    /** @param {HTMLInputElement} field */
    async rightPress(field) {
      field.dispatchEvent(
        new dom.window.MouseEvent('pointerdown', {
          button: 2,
          bubbles: true,
          composed: true,
          clientX: 10,
          clientY: 10,
        }),
      );
      await flush();
    },
    /** @param {Record<string, unknown>} info */
    async click(info) {
      for (const fn of listeners.clicked) {
        fn({ menuItemId: MENU_ID, frameId: 0, ...info }, { id: 1 });
      }
      await flush();
    },
  };
}

describe('Chromium path', () => {
  it('creates a hidden entry on install', async () => {
    const env = createEnvironment({ firefox: false });
    await env.install();
    assert.deepEqual(JSON.parse(JSON.stringify(env.menu())), {
      id: MENU_ID,
      title: messages.menuSiret.message,
      contexts: ['editable'],
      visible: false,
    });
  });

  it('shows the right entry before the menu opens and hides it on traps', async () => {
    const env = createEnvironment({ firefox: false });
    await env.install();

    await env.rightPress(env.input('siret'));
    assert.equal(env.menu()?.visible, true);
    assert.equal(env.menu()?.title, messages.menuSiret.message);

    await env.rightPress(env.input('siren'));
    assert.equal(env.menu()?.visible, true);
    assert.equal(env.menu()?.title, messages.menuSiren.message);

    await env.rightPress(env.input('vat'));
    assert.equal(env.menu()?.visible, false);
  });

  it('updates the entry when the field gets the focus (Menu key, Shift+F10)', async () => {
    const env = createEnvironment({ firefox: false });
    await env.install();
    env.input('siren').focus();
    await flush();
    assert.equal(env.menu()?.visible, true);
    assert.equal(env.menu()?.title, messages.menuSiren.message);
  });

  it('fills the field that was right-clicked', async () => {
    const env = createEnvironment({ firefox: false });
    await env.install();
    await env.rightPress(env.input('siret'));
    await env.click({});
    const value = env.input('siret').value;
    assert.match(value, /^\d{14}$/);
    assert.equal(isValidSiret(value), true);
  });

  it('recreates the entry if the browser lost it', async () => {
    const env = createEnvironment({ firefox: false });
    await env.rightPress(env.input('siret'));
    await flush();
    assert.equal(env.menu()?.visible, true);
  });

  it('does not fill a field that is not recognized', async () => {
    const env = createEnvironment({ firefox: false });
    await env.install();
    await env.rightPress(env.input('vat'));
    await env.click({});
    assert.equal(env.input('vat').value, '');
  });
});

describe('Firefox path', () => {
  it('shows the entry while the menu is open, then hides it', async () => {
    const env = createEnvironment({ firefox: true });
    await env.install();
    env.targets.set(7, env.input('siren'));

    for (const fn of env.listeners.shown) {
      fn({ contexts: ['editable'], frameId: 0, targetElementId: 7 }, { id: 1 });
    }
    await flush();
    assert.equal(env.menu()?.visible, true);
    assert.equal(env.menu()?.title, messages.menuSiren.message);
    assert.equal(env.stats.refreshes, 1);

    for (const fn of env.listeners.hidden) {
      fn();
    }
    await flush();
    assert.equal(env.menu()?.visible, false);
  });

  it('leaves the entry hidden on traps without refreshing', async () => {
    const env = createEnvironment({ firefox: true });
    await env.install();
    env.targets.set(8, env.input('vat'));
    for (const fn of env.listeners.shown) {
      fn({ contexts: ['editable'], frameId: 0, targetElementId: 8 }, { id: 1 });
    }
    await flush();
    assert.equal(env.menu()?.visible, false);
    assert.equal(env.stats.refreshes, 0);
  });

  it('ignores menus outside editable fields and pages without access', async () => {
    const env = createEnvironment({ firefox: true });
    await env.install();
    for (const fn of env.listeners.shown) {
      fn({ contexts: ['page'], frameId: 0 }, { id: 1 });
      fn({ contexts: ['editable'], frameId: 0 }, { id: 1 });
    }
    await flush();
    assert.equal(env.menu()?.visible, false);
    assert.equal(env.stats.refreshes, 0);
  });

  it('fills the target element of the click', async () => {
    const env = createEnvironment({ firefox: true });
    await env.install();
    env.targets.set(9, env.input('siret'));
    await env.click({ targetElementId: 9 });
    const value = env.input('siret').value;
    assert.match(value, /^\d{14}$/);
    assert.equal(isValidSiret(value), true);
  });

  it('does not register the Chromium listeners', async () => {
    const env = createEnvironment({ firefox: true });
    await env.install();
    await env.rightPress(env.input('siret'));
    assert.equal(env.menu()?.visible, false);
  });
});
