// Renders the two illustrations used on the addons.mozilla.org listing
// (1280x800) into store/amo/screenshots/. They depict the extension
// behaviour; they are drawings, not browser captures.
// Usage: node scripts/build-store-images.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { Resvg } from '@resvg/resvg-js';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const icon = readFileSync(`${rootDir}assets/icon.svg`, 'utf8')
  .replace(/<\?xml[^>]*>/, '')
  .replace(/<title>[^<]*<\/title>/, '');

const context = vm.createContext({ crypto: globalThis.crypto });
vm.runInContext(readFileSync(`${rootDir}extension/content/numbers.js`, 'utf8'), context);
const sample = context.SiretFormFiller.numbers.generateSiret();

const FONT = 'Inter, Segoe UI, Arial, sans-serif';
const INDIGO = '#4338CA';

/**
 * @param {number} x
 * @param {number} y
 * @param {string} label
 * @param {string} value
 * @param {{ focused?: boolean, placeholder?: boolean }} [options]
 */
function field(x, y, label, value, options = {}) {
  const stroke = options.focused ? INDIGO : '#C7C9D1';
  const width = options.focused ? 3 : 1.5;
  const color = options.placeholder ? '#9A9DAD' : '#1D1F2B';
  return `
    <text x="${x}" y="${y}" font-family="${FONT}" font-size="20" font-weight="600" fill="#1D1F2B">${label}</text>
    <rect x="${x}" y="${y + 14}" width="520" height="52" rx="10" fill="#fff" stroke="${stroke}" stroke-width="${width}"/>
    <text x="${x + 18}" y="${y + 48}" font-family="${FONT}" font-size="21" fill="${color}">${value}</text>`;
}

/**
 * @param {string} caption
 * @param {string} content
 */
function frame(caption, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
  <rect width="1280" height="800" fill="#EEF0FD"/>
  <g transform="translate(64 44) scale(0.5)">${icon.replace(/<svg[^>]*>/, '').replace('</svg>', '')}</g>
  <text x="140" y="90" font-family="${FONT}" font-size="30" font-weight="700" fill="#1D1F2B">${caption}</text>
  <rect x="64" y="140" width="1152" height="620" rx="18" fill="#fff" stroke="#DFE1E8" stroke-width="2"/>
  <path d="M64 158 a18 18 0 0 1 18 -18 H1198 a18 18 0 0 1 18 18 V196 H64 Z" fill="#F1F2F6"/>
  <circle cx="96" cy="168" r="8" fill="#E5534B"/><circle cx="122" cy="168" r="8" fill="#E8B12E"/><circle cx="148" cy="168" r="8" fill="#3FB86A"/>
  <rect x="190" y="152" width="620" height="32" rx="16" fill="#fff" stroke="#DFE1E8"/>
  <text x="210" y="174" font-family="${FONT}" font-size="17" fill="#5B5F73">app.exemple.test/fournisseurs/nouveau</text>
  <text x="120" y="262" font-family="${FONT}" font-size="30" font-weight="700" fill="#1D1F2B">Nouveau fournisseur</text>
  ${content}
</svg>`;
}

// The right click happens inside the field and the menu opens there; the
// pointer is then drawn on the entry being chosen, which is highlighted.
const pointerX = 440;
const pointerY = 472;
const menuX = pointerX + 2;
const menuY = pointerY + 2;
const ITEM_HEIGHT = 40;
const menuItems = ['Annuler', 'Couper', 'Copier', 'Coller', 'Tout sélectionner'];
let menu = `<rect x="${menuX}" y="${menuY}" width="400" height="${menuItems.length * ITEM_HEIGHT + 76}" rx="10" fill="#fff" stroke="#C7C9D1" stroke-width="1.5"/>`;
menuItems.forEach((item, index) => {
  menu += `<text x="${menuX + 24}" y="${menuY + 32 + index * ITEM_HEIGHT}" font-family="${FONT}" font-size="20" fill="#3B3E4F">${item}</text>`;
});
const highlightY = menuY + menuItems.length * ITEM_HEIGHT + 16;
menu += `<line x1="${menuX + 12}" y1="${highlightY - 8}" x2="${menuX + 388}" y2="${highlightY - 8}" stroke="#E3E5EC" stroke-width="1.5"/>
  <rect x="${menuX + 8}" y="${highlightY}" width="384" height="50" rx="8" fill="${INDIGO}"/>
  <g transform="translate(${menuX + 20} ${highlightY + 11}) scale(0.22)">${icon.replace(/<svg[^>]*>/, '').replace('</svg>', '')}</g>
  <text x="${menuX + 60}" y="${highlightY + 33}" font-family="${FONT}" font-size="20" font-weight="600" fill="#fff">Générer un SIRET aléatoire</text>`;

const first = frame(
  'Clic droit sur un champ SIRET : l’entrée n’apparaît que là où elle sert',
  field(120, 320, 'Raison sociale', 'Atelier Dupont') +
    field(120, 430, 'N° SIRET', '', { focused: true }) +
    field(120, 540, 'Ville', 'Lyon') +
    menu +
    `<path d="M${menuX + 330} ${highlightY + 14} l0 26 l7 -6 l6 12 l5 -3 l-6 -11 l9 -1 Z" fill="#1D1F2B" stroke="#fff" stroke-width="1.5"/>`,
);

const second = frame(
  'Un numéro fictif mais valide : format et clé de contrôle respectés',
  field(120, 320, 'Raison sociale', 'Atelier Dupont') +
    field(120, 430, 'N° SIRET', sample, { focused: true }) +
    `<circle cx="680" cy="477" r="16" fill="#1A7F4B"/><path d="M672 477 l6 6 l11 -12" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
     <text x="706" y="484" font-family="${FONT}" font-size="20" font-weight="600" fill="#1A7F4B">14 chiffres, clé de Luhn valide</text>` +
    field(120, 540, 'Ville', 'Lyon'),
);

for (const [name, svg] of [
  ['1-menu.png', first],
  ['2-rempli.png', second],
]) {
  const png = new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng();
  writeFileSync(`${rootDir}store/amo/screenshots/${name}`, png);
  console.log(`store/amo/screenshots/${name}`);
}
