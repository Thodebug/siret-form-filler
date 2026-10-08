/**
 * Writes a value into a field so that the page and its framework
 * (React, Angular, Vue, input masks) take it into account.
 */
(function (root) {
  'use strict';

  /**
   * @param {string} text
   * @returns {string}
   */
  function digitsOf(text) {
    return String(text).replace(/\D/g, '');
  }

  /**
   * Selects the whole content of the field. Number inputs do not support
   * selection ranges, `select()` covers them.
   * @param {HTMLInputElement} field
   */
  function selectAll(field) {
    try {
      field.select();
    } catch {
      // Some input types refuse selection; insertText then appends, and the
      // digit check below falls back to a direct assignment.
    }
  }

  /**
   * Replaces the content of `field` with `value`.
   *
   * First tries `execCommand('insertText')`, which goes through the browser
   * editing pipeline: it fires trusted beforeinput and input events and keeps
   * Ctrl+Z working. If the resulting value does not hold the expected digits
   * (input mask rejecting the insertion, unsupported input type), the value
   * is assigned directly and an input event is dispatched.
   *
   * A change event always follows. The field keeps the focus (no blur).
   *
   * @param {HTMLInputElement} field
   * @param {string} value Digits only.
   * @returns {'insertText' | 'assignment'} Method that produced the value.
   */
  function fillField(field, value) {
    const document = field.ownerDocument;
    field.focus();
    selectAll(field);

    /** @type {'insertText' | 'assignment'} */
    let method = 'insertText';
    let inserted;
    try {
      inserted = document.execCommand('insertText', false, value);
    } catch {
      inserted = false;
    }

    if (!inserted || digitsOf(field.value) !== value) {
      method = 'assignment';
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    field.dispatchEvent(new Event('change', { bubbles: true }));
    return method;
  }

  const namespace = root.SiretFormFiller || (root.SiretFormFiller = {});
  namespace.fill = { digitsOf, fillField };
})(globalThis);
