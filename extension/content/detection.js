/**
 * Field detection: decides whether an input expects a SIRET, a SIREN or
 * neither, by scoring clues found on the field and around it.
 *
 * The analysis runs on a single field, at interaction time. It never scans
 * the whole page.
 */
(function (root) {
  'use strict';

  /** Input types that can hold a SIRET or a SIREN. */
  const ELIGIBLE_TYPES = new Set(['text', 'tel', 'number', 'search']);

  /** Input types that count as "another field" when looking at containers. */
  const TEXT_LIKE_TYPES = new Set([
    'text',
    'tel',
    'number',
    'search',
    'email',
    'url',
    'password',
    'date',
    'datetime-local',
    'month',
    'week',
    'time',
  ]);

  const WEIGHT_STRONG = 3;
  const WEIGHT_WEAK = 2;
  const BONUS_LENGTH = 2;
  const BONUS_PATTERN = 3;
  const BONUS_MASK = 3;
  const BONUS_PLACEHOLDER_SHAPE = 2;
  const MIN_SCORE = 3;
  const MAX_ANCESTOR_LEVELS = 3;
  const NEIGHBOR_TEXT_LIMIT = 100;
  /** Neighbour text this short is a label in all but name (table cells, grids). */
  const LABEL_LIKE_TEXT_LIMIT = 30;

  /** Own attributes that usually carry the field meaning. */
  const STRONG_ATTRIBUTES = [
    'id',
    'name',
    'formcontrolname',
    'ng-reflect-name',
    'aria-label',
    'placeholder',
  ];
  /** Own attributes that may carry the field meaning, with less certainty. */
  const WEAK_ATTRIBUTES = ['class', 'title', 'autocomplete'];
  /** Attributes read on wrapping elements (component hosts, field groups). */
  const ANCESTOR_ATTRIBUTES = [
    'id',
    'name',
    'class',
    'formcontrolname',
    'ng-reflect-name',
    'label',
    'aria-label',
    'title',
  ];

  /** Longer `pattern` attributes are ignored. */
  const MAX_PATTERN_LENGTH = 120;

  /**
   * Lowercases, strips accents, splits camelCase and keeps only [a-z0-9]
   * words separated by single spaces.
   * @param {string} text
   * @returns {string}
   */
  function normalize(text) {
    return String(text)
      .replace(/([a-z\d])([A-Z])/g, '$1 $2')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\bn\s*[\u00b0\u00ba]/g, ' numero ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /**
   * Finds keywords in one text source.
   * @param {string} text
   * @returns {{ siret: boolean, siren: boolean, blocked: boolean }}
   */
  function scanKeywords(text) {
    const words = normalize(text);
    const siret =
      /sir+et/.test(words) ||
      /\b(numero|num|no|n|number) (d )?etablissement\b/.test(words) ||
      /\bestablishment (number|id|no)\b/.test(words);
    const siren = /siren/.test(words);
    // In a source that names the SIRET, "nic" describes one of its parts.
    const blocked =
      /\btva|tva\b/.test(words) ||
      /\b(vat|rcs)\b/.test(words) ||
      /intra ?com/.test(words) ||
      (!siret && /\bnic\b/.test(words));
    return { siret, siren, blocked };
  }

  /**
   * @param {Element | null | undefined} element
   * @returns {element is HTMLInputElement}
   */
  function isEligible(element) {
    if (!element || element.nodeType !== 1 || element.localName !== 'input') {
      return false;
    }
    const input = /** @type {HTMLInputElement} */ (element);
    if (!ELIGIBLE_TYPES.has(input.type)) {
      return false;
    }
    if (input.disabled || input.readOnly) {
      return false;
    }
    try {
      if (input.matches(':disabled')) {
        return false;
      }
    } catch {
      // Selector not supported: the disabled property check above is enough.
    }
    return true;
  }

  /**
   * @param {Element} element
   * @returns {boolean}
   */
  function isTextLikeControl(element) {
    if (element.localName === 'select' || element.localName === 'textarea') {
      return true;
    }
    if (element.localName !== 'input') {
      return false;
    }
    const type = (element.getAttribute('type') || 'text').toLowerCase();
    return TEXT_LIKE_TYPES.has(type);
  }

  /**
   * Returns the parent element, crossing shadow root boundaries to the host.
   * @param {Element} element
   * @returns {Element | null}
   */
  function parentOf(element) {
    if (element.parentElement) {
      return element.parentElement;
    }
    const rootNode = element.getRootNode();
    if (rootNode && rootNode.nodeType === 11 && 'host' in rootNode) {
      return /** @type {ShadowRoot} */ (rootNode).host;
    }
    return null;
  }

  /**
   * Ancestors (up to MAX_ANCESTOR_LEVELS) that contain no other text-like
   * control than `field`. Stops at the first ancestor shared with another
   * field, so section titles and form-wide attributes are ignored.
   * @param {HTMLInputElement} field
   * @returns {Element[]}
   */
  function singleControlAncestors(field) {
    /** @type {Element[]} */
    const result = [];
    let current = parentOf(field);
    while (current && result.length < MAX_ANCESTOR_LEVELS) {
      if (current.localName === 'body' || current.localName === 'html') {
        break;
      }
      const others = Array.from(current.querySelectorAll('input, select, textarea')).filter(
        (control) => control !== field && isTextLikeControl(control),
      );
      if (others.length > 0) {
        break;
      }
      result.push(current);
      current = parentOf(current);
    }
    return result;
  }

  /**
   * @param {Node} node
   * @returns {string}
   */
  function textOf(node) {
    return (node.textContent || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * @param {Element} field
   * @param {string} id
   * @returns {Element | null}
   */
  function findById(field, id) {
    const rootNode = /** @type {Document | ShadowRoot} */ (field.getRootNode());
    if (rootNode && typeof rootNode.getElementById === 'function') {
      return rootNode.getElementById(id);
    }
    return null;
  }

  /**
   * @typedef {{ text: string, weight: number }} Source
   */

  /**
   * Collects every text that may describe the field, with its weight.
   * @param {HTMLInputElement} field
   * @param {Element[]} ancestors
   * @returns {Source[]}
   */
  function collectSources(field, ancestors) {
    /** @type {Source[]} */
    const sources = [];
    /**
     * @param {string | null | undefined} text
     * @param {number} weight
     */
    const add = (text, weight) => {
      if (text && text.trim()) {
        sources.push({ text, weight });
      }
    };
    /**
     * @param {Element} element
     * @param {number} weight
     */
    const addDataAttributes = (element, weight) => {
      for (const attribute of Array.from(element.attributes)) {
        if (attribute.name.startsWith('data-')) {
          add(`${attribute.name.slice(5)} ${attribute.value}`, weight);
        }
      }
    };

    for (const name of STRONG_ATTRIBUTES) {
      add(field.getAttribute(name), WEIGHT_STRONG);
    }
    for (const name of WEAK_ATTRIBUTES) {
      add(field.getAttribute(name), WEIGHT_WEAK);
    }
    addDataAttributes(field, WEIGHT_WEAK);

    for (const label of Array.from(field.labels || [])) {
      add(textOf(label), WEIGHT_STRONG);
    }
    for (const name of ['aria-labelledby', 'aria-describedby']) {
      const ids = (field.getAttribute(name) || '').split(/\s+/).filter(Boolean);
      for (const id of ids) {
        const referenced = findById(field, id);
        if (referenced) {
          add(textOf(referenced), WEIGHT_STRONG);
        }
      }
    }

    let neighborTextTaken = false;
    for (const ancestor of ancestors) {
      for (const name of ANCESTOR_ATTRIBUTES) {
        add(ancestor.getAttribute(name), WEIGHT_WEAK);
      }
      addDataAttributes(ancestor, WEIGHT_WEAK);
      if (!neighborTextTaken) {
        const text = textOf(ancestor);
        if (text) {
          add(
            text.slice(0, NEIGHBOR_TEXT_LIMIT),
            text.length <= LABEL_LIKE_TEXT_LIMIT ? WEIGHT_STRONG : WEIGHT_WEAK,
          );
          neighborTextTaken = true;
        }
      }
    }
    return sources;
  }

  /**
   * @typedef {'siret' | 'siren'} Kind
   * @typedef {{ bonus: number, incompatible: boolean }} Hint
   */

  /**
   * Reads the number of digits described by a simple `pattern` attribute,
   * without executing it: the page controls this text, and running an
   * arbitrary regular expression could freeze the page (catastrophic
   * backtracking). Recognized: \d or [0-9], with an optional {n} count,
   * separated by optional spaces (" ", " ?", " *", "\s?", "\s*", "[ ]?"),
   * with optional anchors, a (?:...) wrapper and | alternatives. Anything
   * else is ignored.
   * @param {string} pattern
   * @returns {Kind | null}
   */
  function patternKind(pattern) {
    if (pattern.length > MAX_PATTERN_LENGTH) {
      return null;
    }
    let body = pattern.trim().replace(/^\^/, '').replace(/\$$/, '');
    const wrapped = /^\(\?:(.*)\)$/.exec(body);
    if (wrapped) {
      body = wrapped[1];
    }
    /** @type {Set<Kind | null>} */
    const kinds = new Set();
    for (const alternative of body.split('|')) {
      const compact = alternative
        .replace(/\\d|\[0-9\]/g, 'D')
        .replace(/\\s[?*]|\[ \][?*]| [?*]?/g, '');
      if (!/^(?:D(?:\{\d{1,2}\})?)+$/.test(compact)) {
        return null;
      }
      let digits = 0;
      for (const match of compact.matchAll(/D(?:\{(\d{1,2})\})?/g)) {
        digits += match[1] ? Number(match[1]) : 1;
      }
      kinds.add(digits === 14 ? 'siret' : digits === 9 ? 'siren' : null);
    }
    return kinds.size === 1 ? [...kinds][0] : null;
  }

  /**
   * Reads length clues: maxlength, minlength, pattern, input mask and
   * placeholder shape.
   * @param {HTMLInputElement} field
   * @param {Element[]} ancestors
   * @returns {Record<Kind, Hint>}
   */
  function shapeHints(field, ancestors) {
    /** @type {Record<Kind, Hint>} */
    const hints = {
      siret: { bonus: 0, incompatible: false },
      siren: { bonus: 0, incompatible: false },
    };

    if (field.type !== 'number') {
      const maxLength = parseInt(field.getAttribute('maxlength') || '', 10);
      if (maxLength > 0) {
        if (maxLength === 14 || maxLength === 17) {
          hints.siret.bonus += BONUS_LENGTH;
        }
        if (maxLength === 9 || maxLength === 11) {
          hints.siren.bonus += BONUS_LENGTH;
        }
        hints.siret.incompatible ||= maxLength < 14;
        hints.siren.incompatible ||= maxLength < 9;
      }
      const minLength = parseInt(field.getAttribute('minlength') || '', 10);
      if (minLength > 0) {
        hints.siret.incompatible ||= minLength > 17;
        hints.siren.incompatible ||= minLength > 11;
      }
    }

    const pattern = field.getAttribute('pattern');
    const fromPattern = pattern ? patternKind(pattern) : null;
    if (fromPattern) {
      hints[fromPattern].bonus += BONUS_PATTERN;
      hints[fromPattern === 'siret' ? 'siren' : 'siret'].incompatible = true;
    }

    const maskDigits = findMaskDigitCount([field, ...ancestors]);
    if (maskDigits === 14) {
      hints.siret.bonus += BONUS_MASK;
      hints.siren.incompatible = true;
    } else if (maskDigits === 9) {
      hints.siren.bonus += BONUS_MASK;
      hints.siret.incompatible = true;
    }

    const placeholder = (field.getAttribute('placeholder') || '').replace(/[\s.-]/g, '');
    if (/^[0-9x#*_]{14}$/i.test(placeholder)) {
      hints.siret.bonus += BONUS_PLACEHOLDER_SHAPE;
    } else if (/^[0-9x#*_]{9}$/i.test(placeholder)) {
      hints.siren.bonus += BONUS_PLACEHOLDER_SHAPE;
    }
    return hints;
  }

  /**
   * Counts digit slots (9, 0 or #) in the first mask-like attribute found,
   * for example PrimeNG `mask="999 999 999 99999"` on the component host.
   * @param {Element[]} elements
   * @returns {number}
   */
  function findMaskDigitCount(elements) {
    for (const element of elements) {
      for (const attribute of Array.from(element.attributes)) {
        if (/mask/i.test(attribute.name) && attribute.value) {
          const slots = attribute.value.match(/[90#]/g);
          if (slots) {
            return slots.length;
          }
        }
      }
    }
    return 0;
  }

  /**
   * @typedef {{
   *   kind: Kind | null,
   *   scores: Record<Kind, number>,
   *   blockScore: number,
   * }} Detection
   */

  /**
   * Decides what the field expects.
   * @param {Element | null | undefined} element
   * @returns {Detection}
   */
  function detectField(element) {
    /** @type {Detection} */
    const result = { kind: null, scores: { siret: 0, siren: 0 }, blockScore: 0 };
    if (!isEligible(element)) {
      return result;
    }
    const field = element;
    const ancestors = singleControlAncestors(field);
    const keywordFound = { siret: false, siren: false };

    for (const source of collectSources(field, ancestors)) {
      const found = scanKeywords(source.text);
      if (found.siret) {
        result.scores.siret += source.weight;
        keywordFound.siret = true;
      }
      if (found.siren) {
        result.scores.siren += source.weight;
        keywordFound.siren = true;
      }
      if (found.blocked) {
        result.blockScore += source.weight;
      }
    }

    const hints = shapeHints(field, ancestors);
    result.scores.siret += hints.siret.bonus;
    result.scores.siren += hints.siren.bonus;

    /** @type {Kind[]} */
    const kinds = ['siret', 'siren'];
    const candidates = kinds.filter(
      (kind) => keywordFound[kind] && !hints[kind].incompatible && result.scores[kind] >= MIN_SCORE,
    );
    if (candidates.length === 0) {
      return result;
    }
    // Ties go to SIRET: a field accepting both usually accepts 14 digits.
    const best =
      candidates.length === 2 && result.scores.siren > result.scores.siret
        ? 'siren'
        : candidates[0];
    if (result.blockScore >= result.scores[best]) {
      return result;
    }
    result.kind = best;
    return result;
  }

  const namespace = root.SiretFormFiller || (root.SiretFormFiller = {});
  namespace.detection = { normalize, scanKeywords, patternKind, isEligible, detectField };
})(globalThis);
