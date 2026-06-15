# Univers v2 — Agent d'analyse in-app (sous-projet #1) — Design

**Date :** 2026-06-15
**Projet :** Palimpseste (Electron) — `/Users/saidimu/DEV/PROJETS/palimpseste`
**Statut :** design (à valider par l'utilisateur, puis plan)
**Branche :** `feat/wiki`
**Voir aussi :** wiki réel de référence `/Users/saidimu/DEV/wiki/savana/` (CLAUDE.md, grille-lecture.md, alertes-joan.md, pages riches). Sous-tranches Couche 1 déjà livrées (moteur, ingest chapitre/batch, mode avancé, annulation).

---

## Contexte et décision fondatrice

Le wiki Savana (un vault Obsidian maintenu par **Claude Code lâché dans le dossier**, suivant `CLAUDE.md`) produit une analyse **bien meilleure** que notre pipeline in-app rigide : pages riches et interconnectées, détection de contradictions, `alertes-joan.md` (décisions d'auteure). L'utilisateur veut **exactement la même chose, mais dans l'app, sans terminal.**

**Table de correspondance (wiki Savana → Palimpseste) :** ~90 % de la plomberie existe déjà.

| Élément Savana | Palimpseste | État |
|---|---|---|
| `raw/chapitres/*.md` | `.palim/chapitres/*.md` (manuscrit vivant) | ✅ |
| `personnages/ lieux/ themes/ structure/ ecriture/` | `.palim/wiki/<catégorie>/*.md` | ✅ (créés par « Préparer l'analyse ») |
| frontmatter `last_updated`/`sources[]` + `[[wikilinks]]` | `fiche.ts` + `links.ts` | ✅ |
| `index.md`, `log.md`, `CLAUDE.md` | `writeWikiIndex`, `appendLog`, `writeAgentDoc` | ✅ |
| `grille-lecture.md` | `ingestPrompt` GRILLE (générique) | ⚠️ à enrichir |
| `alertes-joan.md` | `alert.ts`/`saveAlert` (pas d'UI) | ⚠️ (sous-projet #3) |
| Q&A `/ask` | `askContext.ts` (pas d'UI) | ⚠️ (sous-projet #5) |
| **l'agent autonome** | rien | ❌ **ce sous-projet** |

**Décision :** ne PAS réimplémenter le cerveau de l'agent. **Lancer le vrai agent (Claude Code) depuis l'app**, en sous-processus headless, dans le dossier `.palim`, piloté par le manuel d'opération — l'app surveille et recharge. Zéro terminal.

## Décomposition Univers v2 (roadmap)

1. **Agent in-app** (CE SPEC) : orchestrer Claude Code headless + menu d'ingestion à statut + rechargement. → « même analyse que Savana, sans terminal ».
2. Rendu riche des fiches (markdown + wikilinks cliquables).
3. Panneau d'alertes (`alertes-joan.md`).
4. Vue graphe des relations.
5. Q&A (interroger l'Univers).

Chacun = son spec + plan. Ce document ne couvre que **#1**.

---

## Objectif (#1)

Un **menu d'ingestion** dans la section Univers qui liste les chapitres avec leur **statut** (non ingéré / modifié depuis l'ingestion / à jour), laisse choisir la **portée** (tout / sélection) et le **moteur**, puis lance l'analyse :
- **Moteur abonnement (`claude`)** → l'app spawn **Claude Code headless** dans le `.palim`, qui édite lui-même les pages wiki en suivant le manuel ; progression en direct ; rechargement à la fin. **Qualité Savana.**
- **Moteur API** → le pipeline structuré existant (Couche 1), inchangé (mode « léger »).

## Faisabilité technique (vérifiée 2026-06-15)

`claude` 2.1.177 installé (`~/.local/bin/claude`). Invocation headless autonome confirmée :
```
claude -p "<tâche>" \
  --permission-mode acceptEdits \
  --append-system-prompt-file <projet>/wiki/CLAUDE.md \
  --output-format stream-json --verbose \
  --max-turns 60
  # (cwd = <projet>, donc accès lecture/écriture à chapitres/ et wiki/ sans --add-dir)
```
Cantonnement de chemins (optionnel) : `--allowedTools` scope les **outils** (Read/Edit/Write/Glob/Grep/Bash), pas les chemins. Pour limiter aux éditions sous `wiki/` et lectures sous `chapitres/`, utiliser des règles de permission via `--settings '{"permissions":{"allow":["Read(chapitres/**)","Edit(wiki/**)","Write(wiki/**)"],"deny":["Bash(rm *)","Bash(git push *)"]}}'`. En v1 (fichiers de l'utilisateur, son propre projet), un accès projet complet est acceptable ; le cantonnement par règles est un durcissement souhaitable mais non bloquant.
- **Auth** : utilise l'**abonnement** de l'utilisateur (`~/.claude` auth), pas de clé API → « gratuit » (forfait). Si l'env contient `ANTHROPIC_API_KEY`, claude pourrait la préférer → on **nettoie l'env** (ne pas passer la clé) pour forcer l'abonnement.
- **Édition de fichiers sans prompt** : `--permission-mode acceptEdits` (les Edit/Write passent ; pas besoin de `--dangerously-skip-permissions`, refusé hors conteneur de toute façon).
- **Manuel** : `--append-system-prompt-file wiki/CLAUDE.md` (explicite ; on ne dépend pas de l'auto-chargement du CLAUDE.md à la racine).
- **Progression live** : `--output-format stream-json --verbose` → flux d'événements NDJSON (init, assistant deltas, tool_use). L'app parse les lignes pour afficher l'activité ; code de sortie 0 = succès.
- **Garde-fous** : `--max-turns`, timeout du spawn (déjà en place), `--allowedTools`/`--disallowedTools` pour cantonner aux éditions sous `wiki/` et lectures sous `chapitres/`.
- **codex / gemini** : installés, mais mode agent édition-de-fichiers non confirmé → **hors périmètre v1** (agent = `claude` uniquement ; `codex exec`/`gemini` à étudier plus tard). L'API reste le mode léger universel.

## Architecture (unités)

### A. Statut d'ingestion (pur + IO)
- Étendre `IntegrationRecord` (4b) d'un champ optionnel `chapterHash?: string` (empreinte du contenu du chapitre au moment de l'ingestion). Rétro-compatible (`toIntegrationRecord` met `undefined`).
- **Pur, testable** : `chapterStatus(chapterId, currentHash, record): 'never' | 'stale' | 'current'`
  - `never` : pas de record.
  - `stale` : record sans hash (héritage) → considéré à jour ; OU record.hash ≠ currentHash.
  - `current` : record.hash === currentHash.
  - (empreinte = hash simple du markdown du chapitre ; pas la mtime, car l'app réécrit les .md à chaque save.)
- IO : un helper pour calculer le hash du contenu d'un chapitre (renderer, sur le markdown obtenu via `docToMarkdownBody`).
- À la fin d'une ingestion (agent OU pipeline), on **enregistre le hash** dans le record du chapitre (`recordIntegration`/`mergeIntegration` reçoivent le hash).

### B. Runner d'agent (main, nouvel IPC)
- `wiki:runAgent({ projectPath, chapterFiles: string[], mode: 'ingest' })` → spawn `claude` comme ci-dessus.
  - cwd = `projectPath`.
  - tâche = prompt généré : « Ingère/mets à jour le wiki pour ces chapitres : `chapitres/NNN-x.md`, ... en suivant le manuel (system). Mets à jour les pages affectées + leur `sources:`, le `log.md`, et `ecriture/alertes-joan.md` pour les décisions/contradictions. N'invente rien. »
  - env : copie de `process.env` **sans** `ANTHROPIC_API_KEY` (forcer l'abonnement).
  - stream-json → le main relaie les événements au renderer via `webContents.send('wiki:agentProgress', evt)` (ou un canal d'événements IPC) : on en extrait des lignes lisibles (outil utilisé, fichier touché, message). Annulation = `child.kill()`.
  - retour `{ ok, summary?, changedFiles?, error? }` (résumé depuis le dernier message ; `changedFiles` best-effort depuis les events tool_use Edit/Write).
- Preload + types (`detectWikiEngines`/`runWikiEngine` existent ; on ajoute `runWikiAgent` + un abonnement aux events de progression).

### C. Manuel d'opération enrichi (pur)
- Enrichir `buildWikiAgentDoc` (`agentDoc.ts`) pour produire un `wiki/CLAUDE.md` à la hauteur du manuel Savana : structure des dossiers, conventions de page (frontmatter `last_updated`/`sources[]`, wikilinks, sections riches, marqueurs d'incertitude, ne pas inventer les noms `XXX`/`(TROUVER NOM)`, pas de tirets cadratins), opérations (ingest chapitre, audit, contradiction → `alertes-joan.md`), et **embarquer la grille de lecture** (la checklist par entité, adaptée de `structure/grille-lecture.md`). C'est ce qui donne la qualité Savana.
- Le bouton « Préparer l'analyse approfondie » écrit déjà ce doc ; on le réutilise tel quel (l'agent le lit via `--append-system-prompt-file`). On s'assure que les dossiers wiki + `CLAUDE.md` existent avant de lancer l'agent (réutilise `writeAgentDoc`).

### D. Orchestrateur renderer + UI
- `src/renderer/lib/wiki/agent.ts` : `runAgentIngest(chapterIds, onProgress, shouldContinue)` — assure le setup (writeAgentDoc), résout les chemins `chapitres/*.md`, appelle `wiki:runAgent`, relaie la progression, à la fin **enregistre les hash** + `loadWiki` (recharge fiches/alertes/index) + recalcule les statuts.
- UI « Ingestion » (section Univers) : 
  - liste des chapitres (depuis le manuscrit, ordre `flattenChapterIds`) avec badge de statut (⬜ non ingéré / 🔄 modifié / ✅ à jour), cases à cocher (défaut : tout ⬜+🔄).
  - sélecteur de moteur existant (`analysisEngine`).
  - bouton « Lancer l'analyse » → si moteur = `claude` (abonnement) : `runAgentIngest` ; si API : `analyzeManuscript`/`ingestChapter` existant sur la sélection.
  - zone de progression (flux d'activité de l'agent ou barre i/N du pipeline) + « Arrêter ».
- `wikiStore` : exposer les `integrations` (déjà fait en 4b) pour calculer les statuts dans l'UI.

## Flux (moteur abonnement)

1. L'utilisateur ouvre le menu Ingestion → voit les statuts.
2. Sélectionne des chapitres (ou tout) → « Lancer ».
3. `runAgentIngest` : `writeAgentDoc` (garantit `wiki/CLAUDE.md` + dossiers) → `wiki:runAgent`.
4. Main spawn `claude` headless ; relaie le flux ; l'agent lit les chapitres, édite les pages wiki, met à jour sources/log/alertes.
5. À la sortie (code 0) : l'app enregistre les hash des chapitres traités dans `integrations.json`, `loadWiki`, recalcule les statuts, notifie un résumé.

## Gestion d'erreurs
- `claude` introuvable / non connecté → message clair (« installe et connecte Claude, ou choisis l'API »). Réutilise `detectEngines`.
- Agent échoue (code ≠ 0) → on remonte stderr/`error` lisible ; les fichiers déjà édités restent (l'agent est transactionnel par fichier ; pas de rollback auto en v1 — l'annulation par chapitre de la 4b ne couvre PAS les éditions agent, voir Limites).
- Annulation utilisateur → `child.kill()` ; ce qui est écrit reste.
- Pas de chapitres sélectionnés → bouton désactivé.
- Sortie de l'agent non structurée → on prend le dernier message comme résumé ; les `changedFiles` sont best-effort.

## Tests
- **Purs** : `chapterStatus` (never/stale/current, record sans hash = current, hash différent = stale) ; le hash de contenu (déterministe) ; le générateur de manuel enrichi (contient les sections clés : conventions, grille, alertes). 
- **Build + runtime** : le runner d'agent et l'UI (IO/processus). Vérif manuelle sur `~/Desktop/Savana.palim` : lancer l'ingestion abonnement sur 1 chapitre → des pages wiki riches apparaissent/évoluent, `sources` à jour, alertes éventuelles ; statut passe à ✅ ; re-modifier le chapitre → statut 🔄.

## Limites assumées (YAGNI v1)
- Agent = **`claude` seulement** (codex/gemini plus tard).
- Pas d'annulation-undo des éditions de l'agent (la 4b couvre le pipeline, pas l'agent). Filet de sécurité = git/snapshots du projet + le `log.md` de l'agent. (Une « annulation d'ingestion agent » pourra venir via snapshots.)
- Rendu riche des pages, panneau d'alertes, graphe, Q&A = sous-projets #2-#5.
- Pas de parallélisme d'agents (un run à la fois) ; l'agent gère lui-même son lot de chapitres.

## Décisions (par défaut)
- Empreinte de fraîcheur = **hash de contenu** (pas mtime), stocké dans `integrations.json`.
- Manuel d'opération = `wiki/CLAUDE.md` enrichi, passé en `--append-system-prompt-file` ; auto-chargement du CLAUDE.md racine non requis.
- Abonnement forcé en retirant `ANTHROPIC_API_KEY` de l'env du sous-processus.
- Cantonnement de l'agent : `--permission-mode acceptEdits` + (optionnel, durcissement) règles `--settings` limitant édition à `wiki/**` et lecture à `chapitres/**`. Non bloquant en v1.
