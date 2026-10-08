/**
 * Content script entry point, injected in every frame.
 *
 * Firefox: the background asks this script to evaluate the right-clicked
 * element (menus.onShown + menus.getTargetElement) while the menu is open.
 *
 * Chromium: there is no onShown event, so this script evaluates the field as
 * soon as the user starts the interaction (right button pressed, focus, Menu
 * key, Shift+F10) and reports the verdict to the background, which shows or
 * hides the menu entry before the menu opens.
 */
(function (root) {
  'use strict';

  if (root.SiretFormFillerContentLoaded) {
    return;
  }
  root.SiretFormFillerContentLoaded = true;

  const { numbers, detection, fill } = /** @type {Required<SiretFormFillerNamespace>} */ (
    root.SiretFormFiller
  );
  const api = /** @type {SffExtensionApi} */ (root.browser || root.chrome);
  const menus = api.menus;
  const getTargetElement =
    menus && typeof menus.getTargetElement === 'function'
      ? menus.getTargetElement.bind(menus)
      : null;
  const usesTargetElement = Boolean(getTargetElement);
  const MAX_SHADOW_DEPTH = 16;

  /** Last field the user interacted with (Chromium path). */
  /** @type {Element | null} */
  let lastTarget = null;

  /**
   * Returns the shadow root of `element`, even when it is closed.
   * @param {Element} element
   * @returns {ShadowRoot | null}
   */
  function openOrClosedShadowRoot(element) {
    try {
      if (api.dom && typeof api.dom.openOrClosedShadowRoot === 'function') {
        return api.dom.openOrClosedShadowRoot(/** @type {HTMLElement} */ (element)) || null;
      }
    } catch {
      // Not an element that can host a shadow root.
    }
    const withRoot = /** @type {Element & { openOrClosedShadowRoot?: ShadowRoot | null }} */ (
      element
    );
    return withRoot.openOrClosedShadowRoot || element.shadowRoot || null;
  }

  /**
   * Descends through shadow roots to the innermost element at (x, y).
   * @param {Element} start
   * @param {number} x
   * @param {number} y
   * @returns {Element}
   */
  function deepElementFromPoint(start, x, y) {
    let element = start;
    for (let depth = 0; depth < MAX_SHADOW_DEPTH; depth++) {
      const shadow = openOrClosedShadowRoot(element);
      const inner = shadow ? shadow.elementFromPoint(x, y) : null;
      if (!inner || inner === element) {
        break;
      }
      element = inner;
    }
    return element;
  }

  /**
   * Returns the focused element, descending through shadow roots.
   * @returns {Element | null}
   */
  function deepActiveElement() {
    let element = document.activeElement;
    for (let depth = 0; element && depth < MAX_SHADOW_DEPTH; depth++) {
      const shadow = openOrClosedShadowRoot(element);
      const inner = shadow ? shadow.activeElement : null;
      if (!inner || inner === element) {
        break;
      }
      element = inner;
    }
    return element;
  }

  /**
   * Whether `node` is `ancestor` or lies inside it, across shadow roots.
   * @param {Element} ancestor
   * @param {Element} node
   * @returns {boolean}
   */
  function composedContains(ancestor, node) {
    /** @type {Node | null} */
    let current = node;
    while (current) {
      if (current === ancestor) {
        return true;
      }
      const rootNode = current.getRootNode();
      current =
        current.parentNode && current.parentNode !== rootNode
          ? current.parentNode
          : rootNode instanceof ShadowRoot
            ? rootNode.host
            : current.parentNode;
    }
    return false;
  }

  /**
   * @param {MouseEvent} event
   * @returns {Element | null}
   */
  function targetFromPointer(event) {
    const first = event.composedPath().find((node) => node instanceof Node && node.nodeType === 1);
    if (!first) {
      return null;
    }
    return deepElementFromPoint(/** @type {Element} */ (first), event.clientX, event.clientY);
  }

  /**
   * Resolves the element a menu action applies to.
   * @param {unknown} targetElementId
   * @returns {Element | null}
   */
  function resolveTarget(targetElementId) {
    if (getTargetElement && typeof targetElementId === 'number') {
      const element = getTargetElement(targetElementId);
      if (element) {
        if (detection.isEligible(element)) {
          return element;
        }
        // The target may be the host of a closed shadow root: the right
        // click focused the real input inside it.
        const active = deepActiveElement();
        return active && composedContains(element, active) ? active : element;
      }
    }
    if (lastTarget && lastTarget.isConnected) {
      return lastTarget;
    }
    return deepActiveElement();
  }

  /**
   * @param {Element} element
   * @returns {boolean}
   */
  function isEditable(element) {
    return (
      element.localName === 'input' ||
      element.localName === 'textarea' ||
      /** @type {HTMLElement} */ (element).isContentEditable === true
    );
  }

  /**
   * Chromium: evaluates `element` and reports the verdict to the background.
   * @param {Element | null} element
   */
  function report(element) {
    lastTarget = element;
    const kind = detection.detectField(element).kind;
    try {
      const sent = api.runtime.sendMessage({ type: 'sff:verdict', kind });
      if (sent && typeof sent.catch === 'function') {
        sent.catch(() => {});
      }
    } catch {
      // Extension reloaded or updated: this orphaned script has nothing to do.
    }
  }

  if (!usesTargetElement) {
    const options = { capture: true, passive: true };
    window.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button === 2) {
          report(targetFromPointer(event));
        }
      },
      options,
    );
    window.addEventListener(
      'contextmenu',
      (event) => {
        const fromPointer = event.clientX !== 0 || event.clientY !== 0;
        report(fromPointer ? targetFromPointer(event) : deepActiveElement());
      },
      options,
    );
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
          report(deepActiveElement());
        }
      },
      options,
    );
    // Focus only matters for editable elements (the menu entry is limited to
    // the "editable" context); skipping the others avoids waking the service
    // worker on every focus change.
    window.addEventListener(
      'focusin',
      () => {
        const element = deepActiveElement();
        if (element && isEditable(element)) {
          report(element);
        }
      },
      options,
    );
  }

  api.runtime.onMessage.addListener(
    /**
     * @param {unknown} message
     * @param {unknown} _sender
     * @param {(response: unknown) => void} sendResponse
     */
    (message, _sender, sendResponse) => {
      if (!message || typeof message !== 'object' || !('type' in message)) {
        return undefined;
      }
      const { type, targetElementId } =
        /** @type {{ type: unknown, targetElementId?: unknown }} */ (message);
      if (type === 'sff:evaluate') {
        sendResponse({ kind: detection.detectField(resolveTarget(targetElementId)).kind });
        return undefined;
      }
      if (type === 'sff:fill') {
        const element = resolveTarget(targetElementId);
        const kind = detection.detectField(element).kind;
        if (!kind || !detection.isEligible(element)) {
          sendResponse({ filled: false });
          return undefined;
        }
        const value = kind === 'siret' ? numbers.generateSiret() : numbers.generateSiren();
        const method = fill.fillField(element, value);
        sendResponse({ filled: true, kind, method });
      }
      return undefined;
    },
  );
})(globalThis);
