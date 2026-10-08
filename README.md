<p align="center">
  <img src="assets/icon.svg" alt="" width="96" height="96" />
</p>

# SIRET Form Filler

[![CI](https://github.com/Thodebug/siret-form-filler/actions/workflows/ci.yml/badge.svg)](https://github.com/Thodebug/siret-form-filler/actions/workflows/ci.yml)

Extension Firefox, Chrome et Edge pour les développeurs et testeurs de formulaires français.
Clic droit sur un champ SIRET : l'entrée « Générer un SIRET aléatoire » remplit le champ avec
un numéro fictif mais valide, qui passe les contrôles de format et de clé. Même chose pour les
champs SIREN.

L'entrée n'apparaît que sur les champs reconnus comme SIRET ou SIREN, sur n'importe quel site.

- [Page de démonstration](https://thodebug.github.io/siret-form-filler/)
- [Politique de confidentialité](https://thodebug.github.io/siret-form-filler/confidentialite.html)

## Installation

### Firefox (142 ou plus)

Installez l'extension depuis
[addons.mozilla.org](https://addons.mozilla.org/firefox/addon/siret-form-filler/). Les mises à
jour sont automatiques.

À l'installation, Firefox demande l'accès à vos données sur tous les sites : c'est ce qui
permet d'examiner le champ cliqué (voir [Confidentialité](#permissions-et-confidentialité)).

### Chrome et Edge (123 ou plus)

L'extension n'est pas publiée sur le Chrome Web Store. Installation manuelle :

1. Téléchargez `siret-form-filler-chromium-X.Y.Z.zip` depuis la
   [dernière release](https://github.com/Thodebug/siret-form-filler/releases/latest) et
   dézippez-le dans un dossier que vous garderez.
2. Ouvrez `chrome://extensions` (ou `edge://extensions`) et activez le **mode développeur**.
3. Cliquez sur **Charger l'extension non empaquetée** et choisissez le dossier dézippé.

L'extension reste installée après un redémarrage. Il n'y a pas de mise à jour automatique :
recommencez avec la nouvelle release (bouton « Recharger » après avoir remplacé le dossier).

## Utilisation

1. Faites un clic droit dans un champ SIRET ou SIREN (ou la touche Menu, ou Maj+F10).
2. Choisissez « Générer un SIRET aléatoire » (ou « Générer un SIREN aléatoire »).
3. Le contenu du champ est remplacé par un numéro valide. Ctrl+Z annule.

Le format écrit est toujours collé : 14 chiffres pour un SIRET, 9 pour un SIREN. Un masque de
saisie qui ajoute des espaces les remet de lui-même.

## Les numéros

- **SIREN** : 8 chiffres aléatoires (le premier non nul) puis une clé de Luhn. Le SIREN de La
  Poste (356 000 000), qui suit une règle à part, n'est jamais produit.
- **SIRET** : un SIREN neuf, 4 chiffres aléatoires, puis une clé de Luhn calculée sur les 13
  chiffres précédents. Le SIRET et son SIREN passent tous deux la clé de Luhn.
- L'aléa vient de `crypto.getRandomValues`. Chaque génération est indépendante.

Il n'existe pas de plage réservée aux numéros de test : un tirage peut tomber sur une
entreprise réelle. L'extension ne vérifie rien en ligne (aucune requête réseau). Utilisez-la
uniquement dans des environnements de test.

## Comment la détection fonctionne

L'analyse porte sur le seul champ cliqué, au moment du clic droit. La page n'est jamais
parcourue en entier.

**Champs éligibles** : `input` de type text, tel, number, search ou sans type, ni en lecture
seule ni désactivé (fieldset désactivé compris). Les `textarea`, `contenteditable`, mots de
passe et champs cachés sont ignorés.

**Textes examinés** (accents retirés, minuscules, camelCase et snake_case découpés, « n° »
compris comme « numéro ») :

| Source                                                                         | Poids |
| ------------------------------------------------------------------------------ | ----- |
| id, name, formcontrolname, aria-label, placeholder du champ                    | 3     |
| Libellés : `label for`, label englobant, `aria-labelledby`, `aria-describedby` | 3     |
| Texte voisin court (30 caractères au plus, cellule de tableau par exemple)     | 3     |
| class, title, autocomplete et attributs `data-*` du champ                      | 2     |
| Attributs des éléments englobants (hôte de composant, groupe de champ)         | 2     |
| Texte voisin plus long (tronqué à 100 caractères)                              | 2     |

Les éléments englobants sont lus sur 3 niveaux au plus, en traversant le shadow DOM vers son
hôte, et seulement tant qu'ils ne contiennent aucun autre champ de saisie : un titre de section
commun à plusieurs champs n'est jamais pris pour un libellé.

**Mots-clés** :

- SIRET : « siret », « sirret », « numéro d'établissement », « establishment number ».
- SIREN : « siren », « sirène ».
- Bloquants : « tva », « vat », « intracom », « rcs », et « nic » sauf dans un texte qui
  nomme aussi le SIRET (« SIRET (SIREN + NIC) »).

**Indices de forme** :

| Indice                                                         | Effet                                  |
| -------------------------------------------------------------- | -------------------------------------- |
| `maxlength` 14 ou 17 / 9 ou 11                                 | +2 SIRET / +2 SIREN                    |
| `maxlength` inférieur à 14 / à 9                               | SIRET / SIREN impossible               |
| `pattern` qui n'accepte que 14 chiffres / que 9                | +3 au type accepté, l'autre impossible |
| Masque à 14 / 9 positions (`mask="999 999 999 99999"`...)      | +3 au type, l'autre impossible         |
| Placeholder en forme de numéro (`123 456 789 00012`, `XXX...`) | +2 au type                             |

**Décision** : un type n'est retenu que s'il a au moins un mot-clé (la longueur seule ne suffit
jamais), un score d'au moins 3 et qu'il n'est pas rendu impossible par la longueur. Entre SIRET
et SIREN, le meilleur score l'emporte ; à égalité, SIRET. Si les mots-clés bloquants pèsent
autant ou plus que le type retenu, rien n'est proposé. Dans le doute, l'entrée reste masquée.

**Cas particuliers** pris en charge : masques de saisie dont l'id ou le masque est sur
l'élément hôte (PrimeNG InputMask), shadow DOM ouvert ou fermé, iframes de toutes origines,
champs ajoutés dynamiquement (SPA).

## Remplissage

Le contenu du champ est sélectionné puis remplacé par `document.execCommand('insertText')`, qui
passe par l'édition native du navigateur : la page reçoit les événements `beforeinput` et
`input` comme pour une frappe, et Ctrl+Z annule. Si la valeur obtenue ne contient pas les bons
chiffres (masque qui refuse l'insertion, type number), la valeur est affectée directement suivie
d'un événement `input`. Un événement `change` est toujours émis ensuite. Le champ garde le
focus.

## Permissions et confidentialité

- **Accès à tous les sites** (script de contenu `<all_urls>`) : nécessaire pour examiner le
  champ cliqué sur n'importe quel site et n'afficher l'entrée que sur les bons champs.
- **Menus contextuels** (`menus` sous Firefox, `contextMenus` sous Chrome et Edge).

Aucune donnée n'est collectée ni transmise, aucune requête réseau, aucun stockage. Le manifeste
le déclare (`data_collection_permissions: { required: ["none"] }`). Si vous retirez la
permission d'accès aux sites dans Firefox, l'entrée de menu n'apparaît simplement plus.

## Limites connues

- Un numéro généré peut correspondre à une entreprise réelle (voir plus haut).
- Le format écrit est toujours collé : un champ dont le `pattern` exige des espaces refusera la
  valeur, sauf si un masque de saisie les ajoute.
- Chrome et Edge n'offrent pas d'événement « menu affiché ». L'extension calcule la visibilité
  de l'entrée dès l'appui sur le bouton droit, avant l'ouverture du menu. Si le navigateur a mis
  l'extension en veille, le tout premier clic droit peut afficher l'état précédent. Un second
  clic droit corrige.
- Chrome et Edge n'injectent pas l'extension dans les onglets déjà ouverts au moment de
  l'installation : rechargez-les une fois.
- Quand l'insertion native échoue et que la valeur est affectée directement, Ctrl+Z ne
  l'annule pas.
- `textarea` et `contenteditable` ne sont pas pris en charge.
- Les champs dont le seul indice est un libellé dessiné en image, ou un texte éloigné du champ,
  ne sont pas reconnus. Aucun forçage manuel n'est prévu.
- Le menu contextuel n'existe pas sur Firefox pour Android : l'extension n'y est pas proposée.

## Développement

Prérequis : Node 22. Le code de l'extension est du JavaScript sans compilation : les fichiers de
`extension/` sont ceux qui sont publiés.

```sh
npm ci
npm run check          # lint, types, tests, build et web-ext lint
npm test               # tests unitaires et d'intégration (node:test + jsdom)
npm run build          # dist/firefox, dist/chromium et un zip par navigateur
npm run start:firefox  # lance Firefox avec l'extension (web-ext run)
npm run start:chromium # lance Chromium avec l'extension
```

| Dossier / fichier       | Rôle                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| `extension/`            | Code publié : manifeste, scripts, icônes, textes (`_locales/fr`)  |
| `extension/content/`    | Génération, détection, remplissage, script de contenu             |
| `extension/background/` | Gestion de l'entrée de menu                                       |
| `test/`                 | Tests unitaires, d'intégration et fixtures                        |
| `site/`                 | Page de démonstration et politique de confidentialité (Pages)     |
| `scripts/`              | Packaging, contrôle de version, rendu des icônes et illustrations |
| `store/amo/`            | Textes et illustrations de la fiche addons.mozilla.org            |
| `docs/SPEC.md`          | Spécification de la v1                                            |

Les tests d'intégration chargent le vrai script d'arrière-plan et le vrai script de contenu face à une API d'extension simulée, pour les chemins Firefox et Chromium. Aucun test ne tourne dans un vrai navigateur.

Le manifeste source contient les clés des deux navigateurs. `npm run build` en tire un
manifeste propre par navigateur, sans toucher au code. Les tests vérifient aussi chaque champ
annoté de la page de démonstration (`data-expected`).

Pour changer l'icône : modifiez `assets/icon.svg` puis lancez `npm run icons`.

## Publier une version

1. Mettez le même numéro de version (SemVer) dans `package.json` et `extension/manifest.json`.
2. Commitez, puis poussez un tag : `git tag v1.2.3 && git push origin v1.2.3`.
3. Le workflow « Release » vérifie le tag, lance tous les contrôles, construit les zips et crée
   la release GitHub avec des notes générées à partir des commits.
4. Si les secrets `AMO_JWT_ISSUER` et `AMO_JWT_SECRET` sont définis, il soumet aussi la version
   à addons.mozilla.org (canal public). Sinon, cette étape est sautée et vous déposez
   `dist/firefox` à la main.

La toute première soumission sur AMO est manuelle : les textes de la fiche sont dans
`store/amo/listing.md`.

## Contribuer

Les tickets et pull requests sont bienvenus, en français ou en anglais.

- Le code (identifiants, commentaires, messages de commit) est en anglais ; l'interface et la
  documentation en français.
- Un champ mal reconnu ? Ajoutez-le dans `test/fixtures/detection.html` avec l'attribut
  `data-expected` (14, 9 ou 0), puis ajustez `extension/content/detection.js`.
- `npm run check` doit passer avant toute pull request.

## Licence

[MIT](LICENSE)
