/**
 * Generation and validation of French company identifiers (SIREN, SIRET).
 *
 * SIREN: 9 digits, the last one is a Luhn check digit.
 * SIRET: SIREN followed by a 5 digit establishment number (NIC); the 14 digits
 * pass the Luhn check as a whole. La Poste establishments (SIREN 356000000) are
 * the documented exception: their SIRET is valid when the sum of its digits is
 * a multiple of 5.
 */
(function (root) {
  'use strict';

  const LA_POSTE_SIREN = '356000000';

  /**
   * Returns a uniformly distributed integer in [0, max) using the Web Crypto API.
   * @param {number} max Exclusive upper bound, between 1 and 256.
   * @returns {number}
   */
  function randomInt(max) {
    const limit = 256 - (256 % max);
    const buffer = new Uint8Array(1);
    for (;;) {
      root.crypto.getRandomValues(buffer);
      if (buffer[0] < limit) {
        return buffer[0] % max;
      }
    }
  }

  /**
   * @param {number} count
   * @returns {string}
   */
  function randomDigits(count) {
    let digits = '';
    for (let i = 0; i < count; i++) {
      digits += String(randomInt(10));
    }
    return digits;
  }

  /**
   * @param {string} digits
   * @returns {boolean}
   */
  function isLuhnValid(digits) {
    if (!/^\d+$/.test(digits)) {
      return false;
    }
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
    return sum % 10 === 0;
  }

  /**
   * Returns the digit that makes `partial` + digit pass the Luhn check.
   * @param {string} partial
   * @returns {string}
   */
  function luhnCheckDigit(partial) {
    for (let digit = 0; digit <= 9; digit++) {
      if (isLuhnValid(partial + digit)) {
        return String(digit);
      }
    }
    throw new Error('Unreachable: a Luhn check digit always exists');
  }

  /**
   * @param {string} value
   * @returns {boolean}
   */
  function isValidSiren(value) {
    return /^\d{9}$/.test(value) && isLuhnValid(value);
  }

  /**
   * @param {string} value
   * @returns {boolean}
   */
  function isValidSiret(value) {
    if (!/^\d{14}$/.test(value)) {
      return false;
    }
    if (value.startsWith(LA_POSTE_SIREN)) {
      let sum = 0;
      for (const char of value) {
        sum += Number(char);
      }
      return sum % 5 === 0;
    }
    return isLuhnValid(value);
  }

  /**
   * Generates a random valid SIREN. The first digit is never 0 and the
   * La Poste SIREN is never produced.
   * @returns {string}
   */
  function generateSiren() {
    for (;;) {
      const body = String(1 + randomInt(9)) + randomDigits(7);
      const siren = body + luhnCheckDigit(body);
      if (siren !== LA_POSTE_SIREN) {
        return siren;
      }
    }
  }

  /**
   * Generates a random valid SIRET built on a fresh random SIREN.
   * @returns {string}
   */
  function generateSiret() {
    const body = generateSiren() + randomDigits(4);
    return body + luhnCheckDigit(body);
  }

  const namespace = root.SiretFormFiller || (root.SiretFormFiller = {});
  namespace.numbers = {
    LA_POSTE_SIREN,
    isLuhnValid,
    luhnCheckDigit,
    isValidSiren,
    isValidSiret,
    generateSiren,
    generateSiret,
  };
})(globalThis);
