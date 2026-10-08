/**
 * Background script: owns the context menu entry.
 *
 * Loaded as an event page in Firefox (background.scripts) and as a service
 * worker in Chromium (background.service_worker). No module syntax, so the
 * same file works in both.
 */
'use strict';

const api = /** @type {SffExtensionApi} */ (globalThis.browser || globalThis.chrome);
const menus = /** @type {SffMenusApi} */ (api.menus || api.contextMenus);
const MENU_ID = 'sff-generate';
const { onShown, onHidden } = menus;
const refresh = menus.refresh ? menus.refresh.bind(menus) : null;

/**
 * @param {'siret' | 'siren'} kind
 * @returns {string}
 */
function titleFor(kind) {
  return api.i18n.getMessage(kind === 'siren' ? 'menuSiren' : 'menuSiret');
}

/**
 * @param {unknown} kind
 * @returns {'siret' | 'siren' | null}
 */
function asKind(kind) {
  return kind === 'siret' || kind === 'siren' ? kind : null;
}

/** Creates the single menu entry, hidden until a field is recognized. */
async function createMenu() {
  await menus.removeAll();
  await new Promise((resolve) => {
    menus.create(
      { id: MENU_ID, title: titleFor('siret'), contexts: ['editable'], visible: false },
      () => {
        // Reading lastError marks it as handled (duplicate id after a race).
        void api.runtime.lastError;
        resolve(undefined);
      },
    );
  });
}

/**
 * Updates the entry, recreating it if the browser lost it.
 * @param {{ visible: boolean, title?: string }} properties
 */
async function updateMenu(properties) {
  try {
    await menus.update(MENU_ID, properties);
  } catch {
    await createMenu();
    await menus.update(MENU_ID, properties).catch(() => {});
  }
}

api.runtime.onInstalled.addListener(() => {
  createMenu();
});
api.runtime.onStartup.addListener(() => {
  createMenu();
});

if (onShown && onHidden && refresh) {
  // Firefox: decide while the menu is open, then refresh it.
  let shownInstance = 0;
  let nextInstance = 1;
  let entryVisible = false;

  onShown.addListener(
    /**
     * @param {{ contexts: string[], frameId?: number, targetElementId?: number }} info
     * @param {{ id?: number } | undefined} tab
     */
    async (info, tab) => {
      if (!info.contexts.includes('editable') || !tab || tab.id === undefined) {
        return;
      }
      const instance = nextInstance++;
      shownInstance = instance;

      /** @type {'siret' | 'siren' | null} */
      let kind = null;
      if (typeof info.targetElementId === 'number') {
        try {
          const response = await api.tabs.sendMessage(
            tab.id,
            { type: 'sff:evaluate', targetElementId: info.targetElementId },
            { frameId: info.frameId || 0 },
          );
          kind = asKind(response && response.kind);
        } catch {
          // No content script in this frame (restricted page, permission
          // withdrawn): the entry stays hidden.
        }
      }
      if (instance !== shownInstance) {
        return;
      }
      if (!kind && !entryVisible) {
        return;
      }
      entryVisible = Boolean(kind);
      await updateMenu(kind ? { visible: true, title: titleFor(kind) } : { visible: false });
      if (instance !== shownInstance) {
        return;
      }
      refresh();
    },
  );

  onHidden.addListener(() => {
    shownInstance = 0;
    if (entryVisible) {
      entryVisible = false;
      updateMenu({ visible: false });
    }
  });
} else {
  // Chromium: the content script reports its verdict before the menu opens.
  api.runtime.onMessage.addListener(
    /** @param {unknown} message */
    (message) => {
      if (
        message &&
        typeof message === 'object' &&
        'type' in message &&
        message.type === 'sff:verdict'
      ) {
        const kind = asKind(/** @type {{ kind?: unknown }} */ (message).kind);
        updateMenu(kind ? { visible: true, title: titleFor(kind) } : { visible: false });
      }
      return undefined;
    },
  );
}

menus.onClicked.addListener(
  /**
   * @param {{ menuItemId: string | number, frameId?: number, targetElementId?: number }} info
   * @param {{ id?: number } | undefined} tab
   */
  (info, tab) => {
    if (info.menuItemId !== MENU_ID || !tab || tab.id === undefined) {
      return;
    }
    api.tabs
      .sendMessage(
        tab.id,
        { type: 'sff:fill', targetElementId: info.targetElementId },
        { frameId: info.frameId || 0 },
      )
      .catch(() => {});
  },
);
