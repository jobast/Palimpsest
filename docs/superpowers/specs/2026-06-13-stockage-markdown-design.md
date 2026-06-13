# Stockage du manuscrit en Markdown — Design

**Date :** 2026-06-13
**Projet :** Palimpseste (Electron) — `/Users/saidimu/DEV/PROJETS/palimpseste`
**Statut :** approuvé (design), en attente de revue du spec
**Voir aussi :** `docs/upgrade-plan-depuis-qt.md` §B′ (stockage) et §E (titre lié TDM↔page).

## Objectif

Faire du **Markdown la source de vérité unique** du manuscrit (un fichier `.md`
par chapitre), en remplacement du TipTap JSON actuel. But : corpus cohérent,
versionnable git, portable, lisible directement par un agent LLM (intégration
future de la bible, modèle Savana), sans perte de ce qui compte pour un roman.

## Principe fondateur

> Dans une app de mise en pages livre, l'**alignement**, le **retrait de 1ʳᵉ
> ligne**, la **police**, l'**interligne**, la **géométrie de page** sont des
> décisions de **format/template** (FormatEngine, source unique) — **pas** du
> contenu paragraphe par paragraphe.

Le `.md` ne porte donc que le **sens** (paragraphes, gras, italique, sauts de
scène, titre de chapitre). L'**affichage** (TipTap + template de format en CSS)
porte tout le **style**. Conséquence : le Markdown ne perd rien d'essentiel.

## Décisions actées

1. **Markdown = source unique.** L'éditeur parse le `.md` à l'ouverture et le
   sérialise à la sauvegarde. Plus de TipTap JSON canonique sur disque.
2. **Un `.md` par chapitre.** Modèle Savana.
3. **Scènes = sauts typographiques `* * *`.** Les scènes ne sont plus des
   entités persistées avec titre/id ; ce sont des séparateurs dans le `.md`.
   L'arbre (TDM) affiche les **chapitres**. *(Si une navigation intra-chapitre
   redevient utile, on dérivera une liste de scènes en parsant les `* * *`, en
   lecture seule — hors périmètre ici.)*
4. **Titre de chapitre = `title:` du frontmatter YAML** du `.md` (source unique).
   Jamais dupliqué dans le corps. L'export le régénère depuis cette source.
5. **Renommage lié TDM ↔ page (bidirectionnel).** Deux vues éditables du même
   `title:` : la table des matières (panneau gauche) et le bloc-titre MAJUSCULE
   en tête de page. Éditer l'une met à jour le frontmatter → l'autre se
   rafraîchit. Garde anti-boucle.
6. **Ordre des chapitres = manifeste `project.json`** (robuste au renommage),
   pas le préfixe de fichier.
7. **Soulignement retiré** de la barre d'outils (l'italique est la norme en
   fiction). Échappatoire `<u>…</u>` inline tolérée si besoin futur.
8. **Surlignages d'analyse non persistés** (recalculés à l'ouverture, comme
   aujourd'hui).
9. **Note privée de chapitre = sidecar `chapitres/<NNN-slug>.note.md`**, jamais
   intercalée dans le manuscrit ni exportée (§D du plan d'upgrade).

## Format disque cible

```
<projet>.palim/
  project.json                    # manifeste : meta, ORDRE chapitres [{id, file}],
                                  #   formatId, style, dialogueStyle, dailyGoal
  chapitres/<NNN-slug>.md         # un chapitre : frontmatter (id, title) + corps Markdown ; scènes = * * *
  chapitres/<NNN-slug>.note.md    # note privée (sidecar), optionnelle
  sheets/*.json                   # inchangé (jusqu'à migration éventuelle vers wiki)
  stats/*.json  reports/reports.json
```

**Frontmatter d'un chapitre :**
```markdown
---
id: 7f3a…              # id stable (UUID), pivot avec le manifeste
title: Le Départ       # SOURCE UNIQUE du titre (TDM + bloc-titre page)
---
Il faisait nuit quand Marie partit…

* * *

La seconde scène commence ici…
```

**Manifeste `project.json` (extrait) :**
```json
{
  "meta": { "title": "...", "author": "..." },
  "formatId": "grand-format",
  "chapters": [ { "id": "7f3a…", "file": "chapitres/001-le-depart.md" } ],
  "dialogueStyle": "cadratin",
  "dailyGoal": 500
}
```

## Architecture (unités)

- **`markdownCodec`** (pur, testable sans UI) :
  - `parseChapter(mdText) -> { frontmatter, doc }` : `gray-matter` pour le
    frontmatter + `tiptap-markdown`/`prosemirror-markdown` pour MD → doc TipTap.
  - `serializeChapter({ frontmatter, doc }) -> mdText` : doc TipTap → MD +
    réécriture du frontmatter. Round-trip stable sur : paragraphes, gras,
    italique, saut de scène (`sceneBreak` ↔ `* * *`).
- **Nœud TipTap `sceneBreak`** ↔ `* * *` (sérialisation/désérialisation).
- **Couche persistance** (`projectStore`) : lit/écrit `chapitres/*.md` + manifeste
  au lieu de `manuscript/documents/*.json` + `structure.json`. L'ordre vient du
  manifeste ; le titre vient du frontmatter.
- **Sync titre** : un seul setter `renameChapter(id, title)` qui met à jour le
  frontmatter (modèle) ; TDM et bloc-titre s'y abonnent (anti-boucle via blocage
  d'événements pendant l'écriture programmatique).
- **Migration** (`migrateJsonToMarkdown`, ponctuelle, idempotente) : convertit
  `manuscript/documents/<id>.json` (TipTap JSON) → `chapitres/<NNN-slug>.md`,
  reconstruit le manifeste, **après sauvegarde `.backups/`**.

## Gestion d'erreurs

- Frontmatter absent/corrompu → titre de repli depuis le nom de fichier + alerte
  non bloquante ; ne jamais écraser le fichier sans sauvegarde.
- MD illisible → ouvrir en lecture seule + notification, plutôt que perdre le
  contenu.
- Migration : idempotente, refuse de tourner si des `.md` existent déjà (évite
  l'écrasement) ; journalise.

## Tests

- **Round-trip** MD↔TipTap : paragraphes, gras, italique, `* * *` ↔ `sceneBreak`,
  caractères typographiques français (— « » U+202F) préservés.
- **Frontmatter** : lecture/écriture `id`/`title` ; titre **non** dupliqué dans le
  corps ; titre de repli si frontmatter manquant.
- **Manifeste** : ordre des chapitres conservé à la sauvegarde/relecture ;
  réordonnancement reflété.
- **Sync titre** : éditer dans la TDM met à jour le frontmatter et le bloc-titre,
  et inversement ; pas de boucle.
- **Migration** : projet d'exemple JSON → MD ; round-trip ; idempotence ;
  sauvegarde créée.
- **Export** PDF/DOCX : titre présent une seule fois (régénéré depuis la source).

## Hors périmètre

- Le **wiki/bible LLM** (§B du plan) — fera l'objet de son propre cycle.
- La **pagination robuste** (§G) — chantier parallèle.
- Titres/statuts **par scène** (scènes = `* * *` nu pour l'instant).
- Migration des `sheets/*.json` vers le wiki Markdown.
