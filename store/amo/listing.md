# Fiche addons.mozilla.org

Textes à saisir lors de la première soumission sur
[addons.mozilla.org/developers](https://addons.mozilla.org/developers/). Les versions suivantes
sont soumises par la CI (voir le README, « Publier une version »).

## Informations générales

- **Nom** : SIRET Form Filler
- **Adresse de la fiche (slug)** : `siret-form-filler`
- **Catégorie** : Développement web
- **Étiquettes** : développement web, formulaires, tests
- **Licence** : MIT
- **Page d'accueil** : https://github.com/Thodebug/siret-form-filler
- **Page d'assistance** : https://github.com/Thodebug/siret-form-filler/issues
- **Politique de confidentialité** : https://thodebug.github.io/siret-form-filler/confidentialite.html
- **Compatible Firefox pour Android** : non (le menu contextuel n'existe pas sur Android)

## Résumé (250 caractères au plus)

Clic droit sur un champ SIRET ou SIREN : l'extension y écrit un numéro fictif mais valide
(format et clé de contrôle). L'entrée n'apparaît que sur les champs reconnus. Pour les
développeurs et testeurs de formulaires français.

## Description

Vous testez des applications de gestion et devez chercher un SIRET valide à chaque fiche
client, fournisseur ou société ? SIRET Form Filler le génère pour vous.

**Utilisation**

Faites un clic droit dans un champ SIRET : l'entrée « Générer un SIRET aléatoire » apparaît.
Un clic, et le champ reçoit 14 chiffres qui passent les contrôles de format et de clé de Luhn.
Sur un champ SIREN, l'entrée devient « Générer un SIREN aléatoire » (9 chiffres).

**Détection**

L'entrée n'apparaît que sur les champs reconnus, sur n'importe quel site. L'extension croise
l'identifiant, le nom, le libellé, le placeholder, les attributs ARIA, la longueur attendue,
le masque de saisie et le texte voisin du champ. Les champs TVA, NIC ou RCS sont écartés.
Les masques de saisie (PrimeNG...), le shadow DOM et les iframes sont pris en charge.

**Remplissage**

Le numéro est écrit comme une saisie : React, Angular, Vue et les masques de saisie le voient,
et Ctrl+Z annule le remplissage dans la plupart des champs.

**Confidentialité**

Aucune donnée collectée, aucune requête réseau, aucun stockage. La permission d'accès à tous
les sites sert uniquement à examiner le champ cliqué.

**Attention**

Les numéros sont fictifs mais valides : il n'existe pas de plage réservée aux tests, un tirage
peut donc coïncider avec une entreprise réelle. À utiliser uniquement dans des environnements
de test.

Page de démonstration : https://thodebug.github.io/siret-form-filler/
Code source (MIT) : https://github.com/Thodebug/siret-form-filler

## Captures

Dans `store/amo/screenshots/`, à téléverser dans cet ordre :

1. `1-menu.png` : « Clic droit sur un champ SIRET : l'entrée n'apparaît que là où elle sert »
2. `2-rempli.png` : « Un numéro fictif mais valide : format et clé de contrôle respectés »

Ce sont des illustrations du fonctionnement, générées par `npm run store-images`.

## Notes pour les relecteurs (champ « Notes to Reviewer »)

The code is plain JavaScript with no bundler, minifier or transpiler: the submitted files are
the files of the repository's `extension/` folder. The packaging script
(`scripts/package.mjs`) only rewrites `manifest.json` per browser.

`<all_urls>` content script: needed to decide, on any site, whether the right-clicked field
expects a SIRET or SIREN number, so the menu entry is shown only on those fields. The script
reads the attributes and labels of the right-clicked field only, the text of elements it
references through aria-labelledby or aria-describedby, and up to 100 characters of the text
next to it. Nothing is stored or sent over the network. The page `pattern` attribute is read
as text and never executed. The `menus` permission is used for the entry and for
`menus.getTargetElement`.

Test page: https://thodebug.github.io/siret-form-filler/
