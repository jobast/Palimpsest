# Codec Markdown v2 sans perte (sous-projet 0a) - Design

Date : 2026-09-13. Contexte : `docs/audit-2026-09-13.md`, §2.1 et Phase 0. Décisions amont actées le même jour : ambition « outil perso solide », format v2 = Markdown étendu + sidecar JSON, personne n'édite les `.md` hors de l'app (lecteurs seulement : agents Univers, grep, diffs).

## 1. Problème

Le codec actuel (`src/shared/markdown/body.ts`) ne connaît que `paragraph`, `firstParagraph`, `heading` 1-3, `sceneBreak`, `chapterTitle` et les marks `bold`/`italic`. L'éditeur (`EditorArea.tsx`) enregistre StarterKit complet, `Underline`, `Highlight` multicolore, `TextAlign`. Conséquences vérifiées :

- Listes, citations, blocs de code, règles : sérialisés vides. Souligné, surligné, barré, code inline, alignement : perdus.
- Les lignes d'un bloc sont jointes par un espace ; les paragraphes ne sont coupés que sur ligne blanche. 102 chapitres sur 103 de `Savana.palim` séparent leurs paragraphes par un simple `\n` : une sauvegarde les aplatit en un paragraphe chacun.
- Fichier illisible à l'ouverture → `continue` silencieux → chapitre absent → fichier supprimé comme orphelin à la sauvegarde suivante.
- YAML de frontmatter corrompu → uuid régénéré → fichier renommé, ancien supprimé, note `.note.md` détachée.

## 2. Objectifs et non-objectifs

Objectifs :
1. Zéro perte par construction : tout document TipTap chargé dans l'éditeur se retrouve identique après sauvegarde puis rechargement.
2. `.md` lisibles et fidèles pour les lecteurs externes (agents, grep, diffs) : CommonMark plus quelques extensions courantes.
3. Ouverture correcte des projets existants sans sidecar (Savana), y compris paragraphes séparés par `\n` simple.
4. Plus jamais de dégradation silencieuse à la lecture d'un chapitre.

Non-objectifs (renvoyés au sous-projet 0b) : sauvegarde incrémentale, suppression des orphelins et des JSON corrompus, confirmation et corbeille, flush à la fermeture, détection de modification externe par mtime, verrou multi-machines.

## 3. Format sur disque

```
Mon-Roman.palim/
  project.json                  inchangé : meta + chapters: [{ id, file }]
  chapitres/
    001-le-depart.md            Markdown étendu (projection lisible)
    001-le-depart.note.md       note privée, inchangé
    .palim/
      <chapter-id>.json         sidecar, fait foi
```

Sidecar `chapitres/.palim/<id>.json` :

```json
{
  "version": 1,
  "mdHash": "<sha256 hex du fichier .md tel qu'écrit>",
  "savedAt": "2026-09-13T10:00:00.000Z",
  "doc": { "type": "doc", "content": [] }
}
```

Règles :
- Nommé par l'`id` du chapitre : indépendant du nom de fichier, donc stable au renommage et au réordonnancement.
- `mdHash` = SHA-256 du contenu complet du `.md` (frontmatter + corps) tel qu'écrit, via `crypto.subtle.digest` (disponible dans le renderer et dans Node 22 ; helper pur `sha256Hex(text): Promise<string>` dans `src/shared/markdown/hash.ts`).
- Le dossier `.palim/` fait partie du projet : jamais ignoré, jamais purgé, inclus dans toute sauvegarde ou copie du `.palim`.
- Écriture atomique via l'IPC `fs:writeFile` existant (`writeFileAtomic`), couverte par le journal de récupération.
- `ls chapitres/*.md` (manuel de l'agent Univers, grep) n'est pas affecté.

## 4. Codec Markdown étendu

Module pur `src/shared/markdown/body.ts` (réécrit), sans import Node ni Electron, testable en `node --test`.

### 4.1 Blocs

| Nœud TipTap | Markdown | Attributs |
|---|---|---|
| `paragraph`, `firstParagraph` | ligne(s) de texte ; blocs séparés par une ligne blanche | `textAlign` : sidecar seulement |
| `heading` (level 1-3) | `#`, `##`, `###` ; level hors 1-3 borné à 3 dans le `.md`, exact dans le sidecar | `textAlign` : sidecar seulement |
| `sceneBreak` | `* * *` (réservé) | |
| `bulletList` / `orderedList` / `listItem` | `- item` / `1. item` ; imbrication par 2 espaces ; en `.md`, un paragraphe par item (les paragraphes suivants d'un item sont émis indentés sur la ligne suivante ; forme exacte dans le sidecar) | `start` d'`orderedList` : numéro du premier item |
| `blockquote` | chaque ligne des blocs enfants préfixée `> ` ; imbrication `> > ` | |
| `codeBlock` | fence ``` + `language` sur la ligne d'ouverture | |
| `horizontalRule` | `---` (distinct de `* * *`) | |
| `hardBreak` | `\` en fin de ligne à l'écriture ; `\` ou deux espaces acceptés en lecture | |
| `chapterTitle` | frontmatter `title` (inchangé, jamais dans le corps) | |
| inconnu | texte inline du nœud, un bloc par nœud (lisible) ; forme exacte dans le sidecar | |

Le `firstParagraph` reste dérivé à la lecture : premier `paragraph` du corps.

### 4.2 Marks

Ordre d'imbrication fixe à l'écriture, de l'extérieur vers l'intérieur : `highlight` > `underline` > `strike` > `italic` > `bold` > `code`. Le `code` est toujours le plus intérieur ; son contenu n'est jamais échappé.

| Mark | Markdown | Attributs |
|---|---|---|
| `bold` | `**x**` | |
| `italic` | `*x*` | |
| `strike` | `~~x~~` | |
| `code` | `` `x` `` | |
| `underline` | `<u>x</u>` | |
| `highlight` | `==x==` | `color` : sidecar seulement |

Marks inconnus : ignorés dans le `.md`, exacts dans le sidecar.

### 4.3 Échappement

À l'écriture, dans le texte courant (hors `code`) :
- caractères : `\`, `*`, `_` (comme aujourd'hui) ;
- séquences ouvrant un mark : `~~`, `==`, `` ` ``, `<u>`, `</u>` → premier caractère échappé (`\~~`, `\==`, `` \` ``, `\<u>`) ;
- début de bloc : `#`, `>`, `+`, `-`, `* `, `N.`, ` ``` `, `---` (déjà en place, étendu à ` ``` ` et `---`).

Un `~`, `=` ou `<` isolé dans la prose n'est jamais échappé. À la lecture, `\x` redonne `x` pour tout `x` échappable.

### 4.4 Parseur tolérant (chemin de secours)

Lecture ligne à ligne du corps :
1. Ligne blanche : séparateur, ignorée.
2. `* * *` seul : `sceneBreak`. `---` seul : `horizontalRule`.
3. `#{1,3} ` : `heading`.
4. ` ``` ` : ouvre un `codeBlock` jusqu'à la fence fermante (contenu brut).
5. `> ` : ligne de `blockquote` ; les lignes consécutives forment un bloc dont le contenu est parsé récursivement après retrait du préfixe.
6. `- `, `* `, `+ `, `N. ` : item de liste ; l'indentation (multiples de 2 espaces) donne l'imbrication ; les lignes suivantes indentées au niveau de l'item en sont la continuation.
7. Autre ligne non vide : **un paragraphe**. Si la ligne se termine par `\` ou par deux espaces, la ligne suivante non vide est ajoutée au même paragraphe après un `hardBreak`.

Règle 7 est le changement de comportement clé : un `\n` simple sépare deux paragraphes (fin du soft-wrap). C'est ce qui rend Savana lisible correctement.

Inline : `***`, `**`, `*`, `~~`, `==`, `` ` ``, `<u>…</u>`, dans cet ordre de priorité, sans chevauchement ; une ouverture sans fermeture est du texte.

### 4.5 Frontmatter

`parseFrontmatter` et `stringifyFrontmatter` inchangés. `parseChapter(md, fallbackTitle, refId)` prend désormais l'`id` du manifeste : `frontmatter.id = refId` toujours ; un `id` différent dans le YAML est ignoré et remplacé à la prochaine écriture.

## 5. Chargement (`projectStore`)

`loadManuscriptFromDisk(projectPath, chapterRefs)` devient, pour chaque `{ id, file }` :

1. Lire `chapitres/<file>`.
   - Échec (`success: false`) ou contenu non textuel : le chapitre est conservé dans `items` avec `title` dérivé du nom de fichier, `status: 'draft'`, et un nouveau champ `loadState: 'unreadable'`. Aucun `documentContents` pour lui. Il n'est ni supprimé ni réécrit (§6).
   - Fichier vide (0 octet) : chapitre valide avec un corps vide (ce n'est pas une erreur).
2. Lire `chapitres/.palim/<id>.json`. Le sidecar est retenu si : lecture OK, JSON valide, `version === 1`, `doc.type === 'doc'`, et `mdHash === sha256(md)`.
   - Retenu : `doc` du sidecar, `loadState: 'exact'`.
   - Sinon : `parseChapter(md, fallbackTitle, id)`, `loadState: 'fromMarkdown'`. Motif journalisé en `console.info` (absent / hash divergent / corrompu / version inconnue).
3. Après la boucle, si au moins un chapitre est `fromMarkdown` alors qu'un sidecar existait (hash divergent ou corrompu), une notification info unique : « N chapitre(s) rechargé(s) depuis le Markdown ». Un projet sans aucun sidecar (Savana, première ouverture) ne déclenche pas de notification.

`ManuscriptItem` gagne `loadState?: 'exact' | 'fromMarkdown' | 'unreadable'` (non persisté). Un chapitre `unreadable` s'affiche dans la TDM avec un marqueur et un bandeau « Fichier illisible : <chemin> » à l'ouverture ; l'éditeur est en lecture seule (`editable: false`) sur un document vide.

Un sidecar dont la `version` est supérieure à celle connue est traité comme absent (repli Markdown), avec le motif « version inconnue » dans la notification.

## 6. Sauvegarde (`saveProject`, périmètre 0a)

Pour chaque chapitre non `unreadable` :
1. `md = serializeChapter({ frontmatter, doc })` avec `frontmatter.id = item.id`.
2. Écrire `chapitres/<file>` (atomique, journalisé).
3. `sidecar = { version: 1, mdHash: await sha256Hex(md), savedAt, doc }` ; écrire `chapitres/.palim/<id>.json` (atomique, journalisé ; `fs:createDirectory` sur `.palim/` au préalable).

L'ordre `.md` puis sidecar garantit qu'une interruption entre les deux laisse un sidecar dont le hash ne correspond plus : au rechargement on parse le `.md` neuf, jamais un `doc` périmé.

Un chapitre `unreadable` n'est jamais sérialisé, jamais réécrit, et sa `ChapterRef` est conservée telle quelle (donc jamais comptée orpheline). Sa `documentContents` absente ne doit pas produire le document par défaut « titre seul » (comportement actuel de `saveProject` pour un `json` manquant) : le cas est traité avant.

Suppression de chapitre : `deleteFile` du `.md` et du sidecar `.palim/<id>.json` (la corbeille arrive en 0b ; en 0a on ajoute seulement le second fichier au chemin de suppression existant).

## 7. Garanties par les tests

Emplacement : `src/main/__tests__/` (runner `node --test`, convention actuelle). Modules purs sous `src/shared/markdown/`.

1. **Corpus de couverture** `src/shared/markdown/__fixtures__/codecCorpus.ts` : un document par nœud et par mark de §4, avec attributs (niveaux, `textAlign`, `color`, `start`, `language`), imbrications de marks, listes imbriquées, item multi-paragraphes, citation contenant une liste, `hardBreak`, nœud inconnu, mark inconnu, texte contenant tous les caractères échappables.
2. **Propriété sidecar** : pour toute fixture, `parseSidecar(stringifySidecar(doc)).doc` est profondément égal à `doc`.
3. **Propriété Markdown** : pour toute fixture, `markdownBodyToContent(docToMarkdownBody(doc))` est égal à `projectMarkdown(doc)`, où `projectMarkdown` est la fonction pure documentant ce que le `.md` perd volontairement (retrait de `textAlign`, `color`, marks/nœuds inconnus, bornage des niveaux). Pour les fixtures sans attribut sidecar-only, `projectMarkdown(doc) === doc`.
4. **Parité schéma** : constante `EDITOR_NODE_AND_MARK_NAMES` dans `src/shared/markdown/schemaNames.ts`, importée par `EditorArea.tsx` pour la garde runtime et par le test ; le test vérifie qu'elle est incluse dans `CODEC_SUPPORTED_NAMES`. Ajouter une extension TipTap sans étendre le codec fait échouer la suite.
5. **Garde runtime** : au montage de l'éditeur, `Object.keys(editor.schema.nodes)` et `.marks` comparés à `CODEC_SUPPORTED_NAMES` ; tout écart → `console.error` et, en développement, notification.
6. **Parseur tolérant** : `\n` simple = deux paragraphes ; `  \n` et `\` = `hardBreak` ; `* * *` vs `---` ; listes imbriquées et ordonnées avec `start` ; citation multi-blocs ; fence avec langue ; échappements ; ouverture sans fermeture.
7. **Chargement** (test du module pur `src/shared/markdown/load.ts` qui encapsule la décision sidecar/markdown à partir de `{ md, sidecarText, refId }`) : sidecar valide ; hash divergent ; JSON corrompu ; version inconnue ; `doc.type` invalide ; frontmatter `id` divergent → `refId` conservé ; entrée `unreadable`.
8. **Savana** : fixture de 3 extraits réels anonymisés au format `\n` simple ; `parse` puis `serialize` puis `parse` conserve le nombre et le contenu des paragraphes.

## 8. Fichiers touchés

- `src/shared/markdown/body.ts` : réécriture (sérialiseur + parseur ligne à ligne).
- `src/shared/markdown/chapter.ts` : signature `parseChapter(md, fallbackTitle, refId)`.
- `src/shared/markdown/sidecar.ts` (nouveau) : types, `stringifySidecar`, `parseSidecar`, `sidecarPath(id)`.
- `src/shared/markdown/hash.ts` (nouveau) : `sha256Hex`.
- `src/shared/markdown/load.ts` (nouveau) : `resolveChapterDoc({ md, sidecarText, refId, fallbackTitle })` → `{ doc, frontmatter, loadState, reason? }`.
- `src/shared/markdown/schemaNames.ts` (nouveau) : `EDITOR_NODE_AND_MARK_NAMES`, `CODEC_SUPPORTED_NAMES`.
- `src/shared/markdown/__fixtures__/codecCorpus.ts` (nouveau).
- `src/shared/types/project.ts` : `ManuscriptItem.loadState?`.
- `src/renderer/stores/projectStore.ts` : `loadManuscriptFromDisk`, boucle chapitres de `saveProject`, suppression (ajout du sidecar).
- `src/renderer/components/editor/EditorArea.tsx` : garde runtime, `editable: false` si `unreadable`.
- `src/renderer/components/layout/Sidebar.tsx` : marqueur `unreadable` ; bandeau dans la zone éditeur.
- `src/main/__tests__/markdown.*.test.ts` : nouveaux tests §7.
- `CLAUDE.md` : section « Format disque » mise à jour (sidecar, règle `\n`).

## 9. Migration et compatibilité

- Aucune migration explicite : un projet sans `.palim/` s'ouvre par le chemin Markdown et obtient ses sidecars à la première sauvegarde.
- Un `.md` écrit par l'ancien codec est lisible par le nouveau (sous-ensemble). Un `.md` écrit par le nouveau codec reste lisible par l'ancien à l'exception des nouvelles constructions (listes, etc.), qui y redeviendraient du texte : on ne revient pas en arrière.
- Le corps canonique écrit par l'app sépare toujours les paragraphes par une ligne blanche ; la règle « `\n` simple = paragraphe » ne concerne que la lecture.

## 10. Risques

- Coût disque et temps de sauvegarde doublés par chapitre tant que la sauvegarde n'est pas incrémentale (0b). Acceptable : ~1,1 Mo de Markdown pour Savana, sidecars du même ordre.
- Un tiers qui modifie un `.md` perd la mise en forme sidecar-only de ce chapitre au rechargement. Conforme à la décision « personne n'édite hors app » ; la notification rend le cas visible.
- Le parseur ligne à ligne est plus complexe que l'actuel ; il est intégralement couvert par le corpus et par les propriétés §7.
