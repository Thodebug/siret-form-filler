import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import vm from 'node:vm';
import { readProjectFile } from './helpers.js';

/** Loads numbers.js in an isolated context that only exposes Web Crypto. */
function loadNumbers() {
  const context = vm.createContext({ crypto: globalThis.crypto });
  vm.runInContext(readProjectFile('extension/content/numbers.js'), context);
  return context.SiretFormFiller.numbers;
}

const numbers = loadNumbers();
const DRAWS = 100_000;

describe('Luhn', () => {
  it('accepts known valid identifiers', () => {
    assert.equal(numbers.isLuhnValid('732829320'), true);
    assert.equal(numbers.isLuhnValid('73282932000074'), true);
    assert.equal(numbers.isLuhnValid('552100554'), true);
  });

  it('rejects altered identifiers and non digits', () => {
    assert.equal(numbers.isLuhnValid('732829321'), false);
    assert.equal(numbers.isLuhnValid('73282932000075'), false);
    assert.equal(numbers.isLuhnValid(''), false);
    assert.equal(numbers.isLuhnValid('7328 29320'), false);
  });

  it('computes the check digit', () => {
    assert.equal(numbers.luhnCheckDigit('73282932'), '0');
    assert.equal(numbers.luhnCheckDigit('7328293200007'), '4');
  });
});

describe('validators', () => {
  it('checks SIREN length and key', () => {
    assert.equal(numbers.isValidSiren('732829320'), true);
    assert.equal(numbers.isValidSiren('73282932'), false);
    assert.equal(numbers.isValidSiren('7328293200'), false);
  });

  it('checks SIRET length and key', () => {
    assert.equal(numbers.isValidSiret('73282932000074'), true);
    assert.equal(numbers.isValidSiret('7328293200007'), false);
    assert.equal(numbers.isValidSiret('73282932000075'), false);
  });

  it('applies the La Poste rule (digit sum multiple of 5)', () => {
    assert.equal(numbers.isValidSiret('35600000000001'), true);
    assert.equal(numbers.isValidSiret('35600000000002'), false);
  });
});

describe('generateSiren', () => {
  it(`produces ${DRAWS} valid SIREN, never starting with 0 nor equal to La Poste`, () => {
    for (let i = 0; i < DRAWS; i++) {
      const siren = numbers.generateSiren();
      assert.match(siren, /^[1-9]\d{8}$/);
      assert.equal(numbers.isLuhnValid(siren), true, siren);
      assert.notEqual(siren, numbers.LA_POSTE_SIREN);
    }
  });

  it('spreads its draws', () => {
    const seen = new Set();
    for (let i = 0; i < 1000; i++) {
      seen.add(numbers.generateSiren());
    }
    assert.ok(seen.size > 990, `only ${seen.size} distinct values out of 1000`);
  });
});

describe('generateSiret', () => {
  it(`produces ${DRAWS} valid SIRET whose SIREN is valid too`, () => {
    for (let i = 0; i < DRAWS; i++) {
      const siret = numbers.generateSiret();
      assert.match(siret, /^[1-9]\d{13}$/);
      assert.equal(numbers.isValidSiret(siret), true, siret);
      assert.equal(numbers.isValidSiren(siret.slice(0, 9)), true, siret);
      assert.notEqual(siret.slice(0, 9), numbers.LA_POSTE_SIREN);
    }
  });

  it('spreads every digit position', () => {
    const digitsByPosition = Array.from({ length: 14 }, () => new Set());
    for (let i = 0; i < 2000; i++) {
      const siret = numbers.generateSiret();
      for (let position = 0; position < 14; position++) {
        digitsByPosition[position].add(siret[position]);
      }
    }
    assert.equal(digitsByPosition[0].size, 9);
    for (let position = 1; position < 14; position++) {
      assert.equal(digitsByPosition[position].size, 10, `position ${position}`);
    }
  });
});
