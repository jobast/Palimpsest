# Pagination : leçons apprises (à ne pas perdre)

Document de référence, indépendant du code. La pagination visuelle « comme un vrai livre » est la raison d'être de Palimpseste et la cause de deux pivots de plateforme. Tout ce qui a été essayé, ce qui a cassé et pourquoi est consigné ici. **Ne pas supprimer ce fichier lors du nettoyage du code mort.** Le mettre à jour à chaque tentative.

Sources : `src/renderer/lib/pagination/PAGINATION_ARCHITECTURE.md` (ancien système, janvier 2026), historique git (`f194442`, `3261fde`, `16dfdf5`, `4b1a6c0`), audit `docs/audit-2026-09-13.md` §2.2, mémoire du projet Qt.

## 1. Chronologie des tentatives

| Quand | Approche | Résultat |
|---|---|---|
| 2026-01-18 (`0702dac`) | **Pagination maison par mesure de nœuds** : `calculatePageBreaks` mesure chaque bloc ProseMirror, accumule les hauteurs, pose des décorations de saut de page (`PageBreakDecorations`) | Dérive verticale cumulative, éditeur inutilisable |
| 2026-01-19 (`f194442`) | Correctif de la dérive : harmonisation CSS entre conteneur de mesure et éditeur, gestion des nœuds plus hauts qu'une page, typographie effective passée à la mesure | Dérive réduite, mais mesure par **clone dans un conteneur caché** fondamentalement fausse (1900-3000 px pour un paragraphe de 17-50 px) |
| 2026-01-19 (phase 2) | Mesure **directe dans le DOM rendu** (`getBoundingClientRect` en place, ratio de largeur pour le zoom) | Hauteurs correctes, mais paragraphes atomiques : un paragraphe qui déborde bascule entier sur la page suivante → blancs en bas de page et **saut à la frappe** près des fins de page |
| 2026-01-21 (`3261fde`) | **Remplacement par `tiptap-pagination-plus`** (mécanisme float, voir §3) | Paragraphes coupés ligne à ligne, plus de dérive cumulative ; mais saut à la frappe persistant, zoom faux, virtualisation contre-productive (diagnostic 2026-09-13) |
| 2026-01-26 (`16dfdf5`) | Virtualisation `content-visibility: hidden` des pages hors écran pour les manuscrits de 100 000 mots | Appliquée à `.rm-page-break`, éléments de hauteur 0 qui ne contiennent pas le texte : on cache le décor et on gonfle le flux de 1123 px par cadre caché |
| 2026-01-26 (`4b1a6c0`) | Export PDF réécrit pour la structure DOM de la lib (html2canvas) | Remplacé en juin par le PDF vectoriel `printToPDF` |
| Printemps 2026 | **Pivot Qt/PySide6** (`palimpseste-qt`) : `QTextDocument` pagine nativement, `PagedEditor` peint chaque page, marges répétées via le root frame format | Pagination stable et sans saut. Mais friction de développement élevée, crash non résolu (double-free `QTreeWidgetItem`), et l'utilisateur préfère l'interface Electron |
| 2026-06-13 | **Retour à Electron**, décision de traiter la pagination de front | Diagnostic complet le 2026-09-13 (§4) |

## 2. Invariants découverts à la dure (valables quel que soit le moteur)

1. **Mesurer dans le DOM réellement rendu, jamais dans un clone.** Un clone dans un conteneur caché perd son contexte de mise en page (`visibility: hidden`, largeur, polices) et renvoie des hauteurs de conteneur.
2. **Les règles CSS du texte doivent être strictement identiques** entre ce qui est mesuré et ce qui est affiché (`p`, `blockquote`, `ul/ol/li`, `hr`, `h1-h3`, titre de chapitre). Une seule règle manquante = dérive cumulative.
3. **La typographie effective** (template + surcharges utilisateur) doit alimenter la mesure, pas la typographie du template seul.
4. **Un nœud plus haut qu'une page** doit forcer un saut avant lui et être plafonné à la hauteur de page, sinon l'erreur se propage à toutes les pages suivantes.
5. **Le zoom est un `transform: scale()`** : toute mesure `getBoundingClientRect` est mise à l'échelle, toute constante en px ne l'est pas. Diviser les mesures par l'échelle avant comparaison, ou mesurer avec `offsetHeight` (non scalé).
6. **Les nœuds ProseMirror sont atomiques** : on ne peut poser un saut de page qu'entre nœuds. Couper un paragraphe exige soit une astuce CSS (floats/exclusions, §3), soit une mesure par lignes (`Range.getClientRects`) avec des espaceurs, qui réintroduit la mesure explicite et ses arrondis.
7. **Un changement du nombre de pages ne doit jamais reconstruire tout le DOM des cadres** : le scroll anchoring de Chromium perd son nœud d'ancrage et la page saute.
8. **Ajouter ou retirer une page demande une hystérésis** (au moins une demi-ligne), sinon une césure en fin de page crée et supprime une page quasi vide à chaque mot.
9. **Repaginer seulement si le document a changé** (`transaction.docChanged`), jamais sur un simple déplacement de curseur, et coalescer dans un seul `requestAnimationFrame`.
10. **Ancrer le caret** : mémoriser le rect du caret avant repagination, corriger `scrollTop` après.
11. **`content-visibility: hidden` ne sert que sur des éléments qui contiennent réellement le texte** et dont la hauteur intrinsèque est exacte ; sinon il déforme le flux.
12. **En-tête et pied de page** : ne compter leur hauteur qu'une fois (l'adaptateur actuel ajoute 40 px ET la lib soustrait la hauteur mesurée), et ne pas les remesurer à chaque frappe si leur contenu est stable.
13. **Polices** : mesurer après `document.fonts.ready` ; sans `@font-face`, les écarts écran/PDF entre machines viennent des polices système de repli.
14. **Éléments flottants** : `getBoundingClientRect()` donne une hauteur 0 au parent d'un float ; utiliser `offsetHeight`/`offsetWidth` de l'élément flottant lui-même (leçon de l'export PDF).

## 3. Comment fonctionne réellement `tiptap-pagination-plus` (v2.0.5)

À documenter correctement car `PAGINATION_ARCHITECTURE.md` décrit l'ancien système et induit en erreur.

- Une seule vue ProseMirror, pas de découpage du document.
- Un widget à la position 0 contient `#pages` avec N cadres `.rm-page-break`. Chaque cadre = un float `.page` de largeur nulle dont le `margin-top` vaut la hauteur de contenu d'une page, plus un float `.breaker` pleine largeur (pied + gap + en-tête).
- Le texte coule normalement ; les line boxes sont repoussées sous chaque `.breaker` pleine largeur. **Les paragraphes sont donc coupés ligne à ligne par exclusion CSS, sans mesure par nœud.** Les frontières sont à positions fixes : pas de dérive cumulative.
- `view.update` s'exécute à chaque transaction : `calculatePageCount` (2 rects), mesure header/footer, écriture de variables CSS, `refreshPage` (offsetTop). Si le nombre de pages change : rAF → transaction meta → reconstruction complète de `#pages`.
- Limites du principe : fragile avec tables, images, `writing-mode` ; pas de veuves/orphelines ni de « garder avec le suivant ».

## 4. Causes du « saut » identifiées le 2026-09-13 (audit §2.2)

1. Reconstruction totale de `#pages` quand la dernière ligne franchit une frontière (`PaginationPlus.js:252-255, :462-465`) : le texte déborde une frame, puis tout est recréé, la hauteur totale change d'un coup de `pageHeight + pageGap`.
2. Pas d'hystérésis (`:433-449`).
3. Hauteur d'en-tête/pied remesurée et réinjectée à chaque update (`utils.js:31, 47`).
4. Zoom : rects scalés vs `pageHeight` non scalé (`:429-434` vs `PagedEditor.tsx:330`) → compte de pages faux, oscillation possible.
5. Virtualisation sur des éléments de hauteur 0 (`PagedEditor.tsx:146-160`).
6. Coût par frappe des extensions maison (`FrenchSpaces` parcourt tout le doc, `WordStats` split tout le texte, `TextAnalysisDecorations` reconstruit son cache).

## 5. Stratégie retenue (décision 2026-09-13)

**Vendoriser** `PaginationPlus.js` (MIT, ~600 lignes) dans `src/renderer/lib/pagination/` et corriger nous-mêmes, dans cet ordre : instrumenter zoom et virtualisation pour confirmer ; `docChanged` + rAF unique ; mesures dé-scalées ; hystérésis + DOM incrémental du dernier cadre seulement ; ancrage du caret ; suppression du double décompte en-tête et de la virtualisation actuelle ; supprimer le code mort de l'ancien système et réécrire la doc d'architecture pour décrire le mécanisme float réel.

Écartés : changer de moteur (CSS paged media = impression seulement ; colonnes = hack ingérable ; multi-vues par page = casse sélection/undo/IME). Reporté : pagination par lignes maison (veuves/orphelines), seulement si le besoin est exprimé.

## 6. Comment vérifier une pagination

- Document de test long (Savana : 103 chapitres) et court (1 page qui bascule sur 2).
- Taper en continu en fin de page 1 à zoom 100 %, 150 %, 75 % : le texte ne doit pas sauter, le compte de pages doit être stable à ±0.
- Créer/supprimer une ligne à la frontière exacte : une seule transition de page, pas d'oscillation.
- Comparer la page écran et la page PDF (`printToPDF`) : même nombre de lignes par page.
- DevTools > Performance : une frappe = un seul layout forcé.
- Vérifier dans DevTools la hauteur réelle des `.rm-page-break` avant d'appliquer toute virtualisation.
