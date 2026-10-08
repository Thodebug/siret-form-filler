import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadPage } from './helpers.js';

/**
 * @param {string} html
 */
function setup(html) {
  const { window, sff } = loadPage(html);
  const input = /** @type {HTMLInputElement} */ (window.document.querySelector('input'));
  /** @type {string[]} */
  const events = [];
  for (const type of ['beforeinput', 'input', 'change', 'blur']) {
    window.document.addEventListener(type, (event) => {
      events.push(`${event.type}:${/** @type {HTMLInputElement} */ (event.target).value}`);
    });
  }
  return { window, sff, input, events };
}

describe('fillField', () => {
  it('assigns the value and notifies the page when insertText is unavailable', () => {
    const { window, sff, input, events } = setup('<input name="siret" value="old">');
    window.document.execCommand = () => false;
    const method = sff.fill.fillField(input, '73282932000074');
    assert.equal(method, 'assignment');
    assert.equal(input.value, '73282932000074');
    assert.deepEqual(events, ['input:73282932000074', 'change:73282932000074']);
    assert.equal(window.document.activeElement, input, 'the field keeps the focus');
  });

  it('uses insertText when the browser supports it, then fires change', () => {
    const { window, sff, input, events } = setup('<input name="siret" value="old">');
    window.document.execCommand = (command, _ui, value) => {
      assert.equal(command, 'insertText');
      input.value = String(value);
      input.dispatchEvent(new window.InputEvent('input', { bubbles: true }));
      return true;
    };
    const method = sff.fill.fillField(input, '732829320');
    assert.equal(method, 'insertText');
    assert.equal(input.value, '732829320');
    assert.deepEqual(events, ['input:732829320', 'change:732829320']);
  });

  it('keeps the masked value produced by insertText when its digits match', () => {
    const { window, sff, input } = setup('<input name="siret">');
    window.document.execCommand = (_command, _ui, value) => {
      const digits = String(value);
      input.value = `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
      return true;
    };
    assert.equal(sff.fill.fillField(input, '73282932000074'), 'insertText');
    assert.equal(input.value, '732 829 320 00074');
  });

  it('falls back to assignment when insertText leaves other digits', () => {
    const { window, sff, input, events } = setup('<input name="siret" value="123">');
    window.document.execCommand = () => {
      input.value = '123732829320';
      return true;
    };
    assert.equal(sff.fill.fillField(input, '732829320'), 'assignment');
    assert.equal(input.value, '732829320');
    assert.deepEqual(events, ['input:732829320', 'change:732829320']);
  });

  it('falls back to assignment when execCommand throws', () => {
    const { window, sff, input } = setup('<input type="number" name="siret">');
    window.document.execCommand = () => {
      throw new Error('not supported');
    };
    assert.equal(sff.fill.fillField(input, '73282932000074'), 'assignment');
    assert.equal(input.value, '73282932000074');
  });
});

describe('digitsOf', () => {
  it('keeps digits only', () => {
    const { sff } = loadPage('');
    assert.equal(sff.fill.digitsOf('732 829-320 00074'), '73282932000074');
  });
});
