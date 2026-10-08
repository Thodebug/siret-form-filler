// Demo page behaviour: info tooltips, key check of filled values, input
// mask, shadow DOM components and dynamic field. This script belongs to the
// demo page only; the extension does not use it.
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
   * Short verdict on the value of a field.
   * @param {string} value
   * @returns {{ text: string, ok: boolean }}
   */
  function verdict(value) {
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 14 && digits.length !== 9) {
      return { text: '', ok: true };
    }
    const ok = isLuhnValid(digits) && isLuhnValid(digits.slice(0, 9));
    return { text: ok ? '\u2713' : '\u2717', ok };
  }

  /**
   * Updates the key check of the field box holding `input`.
   * @param {HTMLInputElement} input
   * @param {Element} box
   */
  function updateStatus(input, box) {
    const status = box.querySelector(':scope > .status');
    if (!status) {
      return;
    }
    const { text, ok } = verdict(input.value);
    status.textContent = text;
    status.title = text ? (ok ? 'Clé de contrôle valide' : 'Clé de contrôle invalide') : '';
    status.classList.toggle('bad', !ok);
  }

  /**
   * @param {Event} event
   */
  function onValue(event) {
    const target = event.composedPath()[0];
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const root = target.getRootNode();
    const anchor = root instanceof ShadowRoot ? root.host : target;
    const box = anchor.closest('.f');
    if (box) {
      updateStatus(target, box);
    }
  }

  /**
   * @param {Document | ShadowRoot} root
   */
  function listen(root) {
    root.addEventListener('input', onValue, true);
    root.addEventListener('change', onValue, true);
  }
  listen(document);

  // Info buttons: the explanation lives in a <template> so that it never
  // becomes text around the field (the extension reads that text).
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  tip.setAttribute('role', 'tooltip');
  tip.id = 'tip';
  document.body.append(tip);

  /**
   * @param {HTMLButtonElement} button
   * @param {HTMLTemplateElement} template
   */
  function showTip(button, template) {
    tip.replaceChildren(template.content.cloneNode(true));
    tip.hidden = false;
    const anchor = button.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    const left = Math.min(anchor.right + 8, window.innerWidth - box.width - 8);
    const below = anchor.bottom + 6;
    const top = below + box.height > window.innerHeight - 8 ? anchor.top - box.height - 6 : below;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  }

  function hideTip() {
    tip.hidden = true;
  }

  for (const box of Array.from(document.querySelectorAll('.f'))) {
    const template = box.querySelector(':scope > template');
    if (!(template instanceof HTMLTemplateElement)) {
      continue;
    }
    const status = document.createElement('span');
    status.className = 'status';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'info';
    button.textContent = 'i';
    button.setAttribute('aria-label', 'Explication');
    button.setAttribute('aria-describedby', 'tip');
    button.addEventListener('mouseenter', () => showTip(button, template));
    button.addEventListener('focus', () => showTip(button, template));
    button.addEventListener('mouseleave', hideTip);
    button.addEventListener('blur', hideTip);
    box.append(status, button);
  }

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
      result += char === '9' ? digits[index++] : char;
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
        'label{display:block;font-weight:600;margin-bottom:4px;padding-right:40px}' +
        'input{box-sizing:border-box;width:100%;padding:7px 10px;font:inherit;' +
        'border:1px solid #c7c9d1;border-radius:8px}' +
        'input:focus{outline:2px solid #4338ca;outline-offset:1px}';
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

  document.getElementById('addField')?.addEventListener('click', (event) => {
    const button = /** @type {HTMLButtonElement} */ (event.currentTarget);
    const label = document.createElement('label');
    label.htmlFor = 'dynamicField';
    label.textContent = 'SIRET ajouté';
    const input = document.createElement('input');
    input.id = 'dynamicField';
    button.replaceWith(label, input);
    input.focus();
  });
})();
