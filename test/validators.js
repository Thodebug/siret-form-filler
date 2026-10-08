// Independent SIREN and SIRET validators, used by the tests to check what the
// extension generates. They are not shipped with the extension.

const LA_POSTE_SIREN = '356000000';

/**
 * @param {string} digits
 * @returns {boolean}
 */
export function isLuhnValid(digits) {
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
 * @param {string} value
 * @returns {boolean}
 */
export function isValidSiren(value) {
  return /^\d{9}$/.test(value) && isLuhnValid(value);
}

/**
 * La Poste establishments follow their own rule: the sum of the 14 digits
 * is a multiple of 5.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidSiret(value) {
  if (!/^\d{14}$/.test(value)) {
    return false;
  }
  if (value.startsWith(LA_POSTE_SIREN)) {
    return [...value].reduce((sum, char) => sum + Number(char), 0) % 5 === 0;
  }
  return isLuhnValid(value);
}
