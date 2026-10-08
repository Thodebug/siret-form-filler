# Spécification v1 : SIRET Form Filler

Spécification validée avant le développement de la v1, mise à jour des ajustements faits pendant
celui-ci (signalés « ajusté »).

## 1. Projet

- **Nom** : SIRET Form Filler. Dépôt public `Thodebug/siret-form-filler`, licence MIT.
- **Auteur affiché** : Thodebug, partout (manifeste, licence, fiche AMO).
- **Langues** : interface, README, fiche AMO et politique de confidentialité en français. Code
  (identifiants, commentaires, messages de commit) en anglais.
- **Navigateurs** : Firefox 142+ (ajusté : 140 prévu, 142 évite l'avertissement de web-ext sur
  `data_collection_permissions` pour Android), Chrome et Edge 123+. Firefox Android non visé.
- **Distribution, sans coût** : Firefox sur AMO en public (mises à jour automatiques) ; Chrome
  et Edge par le zip des releases GitHub, en mode développeur. Pas de Chrome Web Store.
- **Identifiant gecko** : `siret-form-filler@thodebug.github.io`.
- **Icône** : piste « B1 », un champ blanc sur fond indigo avec un trait par chiffre groupés
  3-3-3-5. Source `assets/icon.svg`, PNG 16 à 128 générés.
- **Pas de CHANGELOG** : notes de release générées par GitHub.

## 2. Numéros

- Générés : SIRET et SIREN uniquement (ni NIC ni TVA).
- SIREN : 8 chiffres aléatoires (premier non nul) + clé de Luhn ; 356000000 exclu.
- SIRET : SIREN neuf + 4 chiffres + clé de Luhn sur les 13 chiffres.
- Aléa : `crypto.getRandomValues`, tirages indépendants.
- Format écrit : toujours collé.
- Risque de tomber sur une entreprise réelle : accepté et documenté, aucune requête réseau.

## 3. Détection

Analyse d'un seul champ au moment de l'interaction.

- **Éligibles** : `input` text, tel, number, search ou sans type ; ni readonly ni disabled.
  Exclus : textarea, contenteditable, password, hidden, email...
- **Sources et poids** :
  - id, name, formcontrolname, ng-reflect-name, aria-label, placeholder : 3 ;
  - libellés (`labels`, `aria-labelledby`, `aria-describedby`) : 3 ;
  - class, title, autocomplete, `data-*` du champ : 2 ;
  - attributs des englobants (3 niveaux, à travers le shadow DOM, tant qu'ils ne contiennent
    aucun autre champ texte) : 2 ;
  - texte voisin (premier englobant non vide) : 3 s'il fait 30 caractères au plus (ajusté :
    c'est un libellé de fait, cas des tableaux), 2 sinon, tronqué à 100 caractères.
- **Vocabulaire** : SIRET (« siret », « sirret », « numéro d'établissement », « establishment
  number »), SIREN (« siren », « sirène »), bloquants (« tva », « vat », « intracom », « rcs »,
  « nic » sauf si la même source nomme le SIRET).
- **Indices de forme** : maxlength 14/17 (+2 SIRET), 9/11 (+2 SIREN), maxlength trop court ou
  minlength trop long rend le type impossible ; pattern n'acceptant qu'un des deux formats (+3,
  l'autre impossible) ; masque à 14 ou 9 positions (+3, l'autre impossible) ; placeholder en
  forme de numéro (+2).
- **Décision** : mot-clé obligatoire, score d'au moins 3, type non impossible ; meilleur score,
  égalité au SIRET ; masqué si les bloquants pèsent autant ou plus. Dans le doute, masqué.
- **Aucune échappatoire** : ni raccourci, ni sélecteurs, ni sites exclus.
- **Cas limites** : iframes (`all_frames`, `match_about_blank`, `match_origin_as_fallback`),
  shadow DOM ouvert et fermé, champs dynamiques.

## 4. Interaction

- Une entrée de menu, contexte `editable`, masquée par défaut. Libellé selon le type :
  « Générer un SIRET aléatoire » ou « Générer un SIREN aléatoire ».
- Firefox : `menus.onShown`, évaluation par le script de contenu de la frame via
  `getTargetElement`, puis `update` et `refresh` si le menu est toujours ouvert ; entrée remasquée
  à `onHidden`.
- Chrome et Edge : verdict calculé au `pointerdown` du bouton droit, au `focusin`, à la touche
  Menu et à Maj+F10, puis envoyé au service worker qui met à jour l'entrée.
- Entrée recréée à `onInstalled` et `onStartup` ; recréée aussi si une mise à jour échoue.
- Remplissage : remplacement du contenu par `execCommand('insertText')` (Ctrl+Z), repli sur
  l'affectation directe + `input` si les chiffres obtenus diffèrent, puis `change`. Pas de blur.
- Rien d'autre : ni presse-papiers, ni notification, ni historique, ni bouton, ni options.

## 5. Permissions et vie privée

- Firefox : `menus` ; Chrome et Edge : `contextMenus`. Script de contenu `<all_urls>`.
- `data_collection_permissions: { required: ["none"] }`, aucune requête réseau, aucun stockage.
- Permission retirée dans Firefox : l'entrée reste masquée, sans erreur.

## 6. Technique et qualité

- JavaScript sans bundler, typé par JSDoc, vérifié par `tsc` (TypeScript 5.9, `checkJs`).
- Un manifeste source ; `scripts/package.mjs` écrit le manifeste de chaque navigateur et un zip.
- Tests unitaires `node:test` + jsdom : génération (100 000 tirages par type), validateurs,
  détection sur fixtures et sur la page de démo, shadow DOM, remplissage, cohérence du projet
  (versions, messages, icônes, absence des caractères « tiret cadratin », « tiret demi-cadratin »
  et « point médian »).
- Tests d'intégration : vrais scripts d'arrière-plan et de contenu face à une API d'extension
  simulée (chemins Firefox et Chromium). Pas de tests dans un vrai navigateur.
- Page de démo et politique de confidentialité sur GitHub Pages.
- ESLint, Prettier, `web-ext lint` (avertissements bloquants), CI GitHub Actions.
- Release sur tag `vX.Y.Z` : contrôles, zips, release GitHub, soumission AMO si les secrets
  `AMO_JWT_ISSUER` et `AMO_JWT_SECRET` existent. Première soumission AMO manuelle.

## 7. Hors périmètre v1

Génération de NIC et de TVA ; raccourci, bouton, popup, options, sélecteurs, sites exclus ;
presse-papiers et historique ; Chrome Web Store, Edge Add-ons, Firefox Android ; interface en
anglais ; textarea et contenteditable ; vérification d'existence réelle ; tests de bout en bout.

## 8. Critères d'acceptation

1. Chaque SIRET généré a 14 chiffres et passe Luhn, son SIREN aussi. Chaque SIREN a 9 chiffres,
   passe Luhn et n'est jamais 356000000.
2. Sur la démo, clic droit sur chaque champ « entrée 14 chiffres » : l'entrée SIRET apparaît et
   remplit le champ avec 14 chiffres valides.
3. Même chose sur les champs « entrée 9 chiffres », avec 9 chiffres et le libellé SIREN.
4. Sur les pièges (TVA, NIC, RCS, longueur sans mot-clé, aucun indice, lecture seule,
   désactivé, textarea, titre de section), aucune entrée n'apparaît.
5. Le champ masqué façon PrimeNG, les champs en shadow DOM ouvert et fermé, les deux iframes
   et le champ ajouté dynamiquement sont reconnus et remplis.
6. Après remplissage, la page reçoit `input` et `change`, et Ctrl+Z restaure l'ancienne valeur.
7. La touche Menu et Maj+F10 sur un champ reconnu affichent l'entrée.
8. Aucune requête réseau émise par l'extension.
9. `web-ext lint` sans avertissement ; lint, types et tests verts en CI ; deux zips produits.
10. L'extension s'installe dans Firefox 142+ depuis AMO, et dans Chrome et Edge en mode
    développeur depuis le zip.
