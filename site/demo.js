// Demo page behaviour: input mask, shadow DOM components, dynamic field,
// key check of filled values and event log. This script belongs to the demo
// page only; the extension does not use it.
(function () {
  'use strict';

  /**
   * @param {string} digits
   * @returns {boolean}
   */
  function isLuhnValid(digits) {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      let digit = Number(digits[digits.length - 1 - i]);
      if (i % 2 === 1) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      sum += digit;
    }
    return digits.length > 0 && sum % 10 === 0;
  }

  /**
   * Describes the value of a field for the status line.
   * @param {string} value
   * @returns {{ text: string, ok: boolean }}
   */
  function describe(value) {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      return { text: '', ok: true };
    }
    if (digits.length === 14 || digits.length === 9) {
      const ok = isLuhnValid(digits) && (digits.length === 9 || isLuhnValid(digits.slice(0, 9)));
      return {
        text: ok
          ? `Clé valide, ${digits.length} chiffres`
          : `Clé invalide, ${digits.length} chiffres`,
        ok,
      };
    }
    return { text: `${digits.length} chiffres`, ok: false };
  }

  /**
   * @param {Element} field
   * @returns {string}
   */
  function nameOf(field) {
    const input = /** @type {HTMLInputElement} */ (field);
    return input.name || input.id || input.getAttribute('aria-label') || input.localName;
  }

  const log = /** @type {HTMLOListElement} */ (document.getElementById('eventLog'));

  /**
   * @param {Event} event
   */
  function record(event) {
    const target = /** @type {Element | null} */ (event.composedPath()[0] || null);
    if (!target || target.localName !== 'input') {
      return;
    }
    const input = /** @type {HTMLInputElement} */ (target);
    if (event.currentTarget === document && input.getRootNode() !== document) {
      // Handled by the listener installed inside the shadow root.
      return;
    }
    const item = document.createElement('li');
    item.textContent = `${event.type} sur ${nameOf(input)} : "${input.value}"${
      event.isTrusted ? '' : ' (synthétique)'
    }`;
    log.prepend(item);
    while (log.children.length > 40) {
      log.lastElementChild?.remove();
    }

    const status = /** @type {HTMLElement | null} */ (
      (event.currentTarget instanceof ShadowRoot ? event.currentTarget.host : input)
        .closest('.case')
        ?.querySelector('.status') || null
    );
    if (status) {
      const description = describe(input.value);
      status.textContent = description.text;
      status.classList.toggle('bad', !description.ok);
    }
  }

  /**
   * @param {Document | ShadowRoot} root
   */
  function listen(root) {
    root.addEventListener('input', record, true);
    root.addEventListener('change', record, true);
  }
  listen(document);

  document.getElementById('clearLog')?.addEventListener('click', () => {
    log.replaceChildren();
  });

  /**
   * Formats digits with a mask where 9 stands for a digit.
   * @param {string} mask
   * @param {string} digits
   * @returns {string}
   */
  function applyMask(mask, digits) {
    let result = '';
    let index = 0;
    for (const char of mask) {
      if (index >= digits.length) {
        break;
      }
      if (char === '9') {
        result += digits[index++];
      } else {
        result += char;
      }
    }
    return result;
  }

  for (const host of Array.from(document.querySelectorAll('p-inputmask'))) {
    const mask = host.getAttribute('mask') || '';
    const slots = (mask.match(/9/g) || []).length;
    const input = host.querySelector('input');
    input?.addEventListener('input', () => {
      input.value = applyMask(mask, input.value.replace(/\D/g, '').slice(0, slots));
    });
  }

  class DemoField extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) {
        return;
      }
      this.dataset.ready = 'yes';
      const mode = this.getAttribute('mode') === 'closed' ? 'closed' : 'open';
      const root = this.attachShadow({ mode });
      const style = document.createElement('style');
      style.textContent =
        'label{display:block;font-weight:600;margin-bottom:6px}' +
        'input{box-sizing:border-box;width:100%;padding:8px 10px;font:inherit;' +
        'border:1px solid #c7c9d1;border-radius:8px}';
      const label = document.createElement('label');
      label.htmlFor = 'inner';
      label.textContent = this.getAttribute('label') || '';
      const input = document.createElement('input');
      input.id = 'inner';
      input.name = this.getAttribute('name') || '';
      root.append(style, label, input);
      // Events from a closed shadow root are retargeted to the host: listen
      // inside to read the real input.
      listen(root);
    }
  }
  customElements.define('sff-demo-field', DemoField);

  document.getElementById('addField')?.addEventListener('click', () => {
    const slot = document.getElementById('dynamicSlot');
    if (!slot) {
      return;
    }
    const label = document.createElement('label');
    label.htmlFor = 'dynamicField';
    label.textContent = 'SIRET ajouté dynamiquement';
    const input = document.createElement('input');
    input.id = 'dynamicField';
    slot.replaceChildren(label, input);
    input.focus();
  });
})();
