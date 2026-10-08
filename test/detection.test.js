import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EXPECTED_KIND, loadPage, readProjectFile } from './helpers.js';

/**
 * Checks every element carrying data-expected in `html`.
 * @param {string} html
 * @param {string} label
 */
function checkExpectations(html, label) {
  const { window, sff } = loadPage(html);
  const fields = Array.from(window.document.querySelectorAll('[data-expected]'));
  assert.ok(fields.length > 0, `${label}: no field with data-expected`);
  for (const [index, field] of fields.entries()) {
    const expected =
      EXPECTED_KIND[/** @type {'14' | '9' | '0'} */ (field.getAttribute('data-expected'))];
    const detection = sff.detection.detectField(field);
    assert.equal(
      detection.kind,
      expected,
      `${label} #${index}: ${field.outerHTML}\nscores=${JSON.stringify(detection.scores)} block=${detection.blockScore}`,
    );
  }
  return fields.length;
}

describe('normalize', () => {
  it('lowercases, strips accents, splits camelCase and expands n°', () => {
    const { sff } = loadPage('');
    assert.equal(sff.detection.normalize('N° SIRET'), 'numero siret');
    assert.equal(sff.detection.normalize('companySiretNumber'), 'company siret number');
    assert.equal(sff.detection.normalize("Numéro d'établissement"), 'numero d etablissement');
    assert.equal(sff.detection.normalize('siret_client-id'), 'siret client id');
  });
});

describe('scanKeywords', () => {
  it('finds SIRET, SIREN and blocking words', () => {
    const { sff } = loadPage('');
    /** @param {string} text */
    const scan = (text) => ({ ...sff.detection.scanKeywords(text) });
    assert.deepEqual(scan('N° SIRET'), { siret: true, siren: false, blocked: false });
    assert.deepEqual(scan('SIREN'), { siret: false, siren: true, blocked: false });
    assert.deepEqual(scan('SIRET (SIREN + NIC)'), { siret: true, siren: true, blocked: false });
    assert.deepEqual(scan('NIC'), { siret: false, siren: false, blocked: true });
    assert.deepEqual(scan('numTva'), { siret: false, siren: false, blocked: true });
    assert.deepEqual(scan('tvaIntra'), { siret: false, siren: false, blocked: true });
    assert.deepEqual(scan('Private'), { siret: false, siren: false, blocked: false });
    assert.deepEqual(scan('Clinic'), { siret: false, siren: false, blocked: false });
  });
});

describe('patternKind', () => {
  it('reads simple SIRET and SIREN patterns', () => {
    const { sff } = loadPage('');
    const kind = sff.detection.patternKind;
    assert.equal(kind('[0-9]{14}'), 'siret');
    assert.equal(kind(String.raw`^\d{14}$`), 'siret');
    assert.equal(kind(String.raw`\d{3} ?\d{3} ?\d{3} ?\d{5}`), 'siret');
    assert.equal(kind(String.raw`(?:\d{14}|\d{3} \d{3} \d{3} \d{5})`), 'siret');
    assert.equal(kind(String.raw`\d{9}`), 'siren');
    assert.equal(kind(String.raw`\d{3}\s?\d{3}\s?\d{3}`), 'siren');
  });

  it('ignores patterns it does not fully understand', () => {
    const { sff } = loadPage('');
    const patterns = [
      '[0-9]*',
      String.raw`\d{14}|\d{9}`,
      String.raw`\d{3,5}`,
      String.raw`FR\d{11}`,
    ];
    for (const pattern of patterns) {
      assert.equal(sff.detection.patternKind(pattern), null, pattern);
    }
  });

  it('never runs the page pattern, so a catastrophic one stays instant', () => {
    const { window, sff } = loadPage(
      String.raw`<label for="f">SIRET</label><input id="f" pattern="(\d|\d|\d|\d|\d|\d|\d|\d)*x">`,
    );
    const started = Date.now();
    const detection = sff.detection.detectField(window.document.getElementById('f'));
    assert.ok(Date.now() - started < 200, 'detection took too long');
    assert.equal(detection.kind, 'siret');
  });
});

describe('detectField on fixtures', () => {
  it('matches every expectation of test/fixtures/detection.html', () => {
    const count = checkExpectations(readProjectFile('test/fixtures/detection.html'), 'fixtures');
    assert.ok(count >= 40, `only ${count} fixtures`);
  });

  it('matches every static expectation of the demo page', () => {
    checkExpectations(readProjectFile('site/index.html'), 'demo');
  });

  it('returns no kind for null, text nodes and non inputs', () => {
    const { window, sff } = loadPage('<p id="p">SIRET</p>');
    assert.equal(sff.detection.detectField(null).kind, null);
    assert.equal(sff.detection.detectField(window.document.getElementById('p')).kind, null);
  });
});

describe('detectField with shadow DOM', () => {
  /**
   * @param {'open' | 'closed'} mode
   * @param {string} inner
   * @param {string} [hostAttributes]
   */
  function buildShadow(mode, inner, hostAttributes = '') {
    const { window, sff } = loadPage(
      `<form><div class="row"><x-field ${hostAttributes}></x-field></div></form>`,
    );
    const host = /** @type {Element} */ (window.document.querySelector('x-field'));
    const shadow = host.attachShadow({ mode });
    shadow.innerHTML = inner;
    return { sff, input: /** @type {HTMLInputElement} */ (shadow.querySelector('input')) };
  }

  it('reads a label inside an open shadow root', () => {
    const { sff, input } = buildShadow('open', '<label for="i">N° SIRET</label><input id="i">');
    assert.equal(sff.detection.detectField(input).kind, 'siret');
  });

  it('reads a label inside a closed shadow root', () => {
    const { sff, input } = buildShadow('closed', '<label for="i">SIREN</label><input id="i">');
    assert.equal(sff.detection.detectField(input).kind, 'siren');
  });

  it('crosses the shadow boundary to read the host attributes', () => {
    const { sff, input } = buildShadow(
      'closed',
      '<input>',
      'formcontrolname="siret" mask="999 999 999 99999"',
    );
    assert.equal(sff.detection.detectField(input).kind, 'siret');
  });

  it('ignores a host whose light DOM holds another field', () => {
    const { window, sff } = loadPage(
      '<form><x-group label="SIRET"><input name="other"></x-group></form>',
    );
    const host = /** @type {Element} */ (window.document.querySelector('x-group'));
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<input><slot></slot>';
    const input = /** @type {HTMLInputElement} */ (shadow.querySelector('input'));
    assert.equal(sff.detection.detectField(input).kind, null);
  });
});

describe('detectField on dynamic content', () => {
  it('detects a field added after load', () => {
    const { window, sff } = loadPage('<form id="f"></form>');
    const row = window.document.createElement('div');
    row.innerHTML = '<label for="late">SIRET</label><input id="late">';
    window.document.getElementById('f')?.append(row);
    assert.equal(sff.detection.detectField(window.document.getElementById('late')).kind, 'siret');
  });
});
