# Univers — Préparation pour l'analyse par agent externe — Design

**Date :** 2026-06-14
**Projet :** Palimpseste (Electron) — `/Users/saidimu/DEV/PROJETS/palimpseste`
**Statut :** approuvé (design ; à implémenter)
**Branche :** `feat/wiki`
**Voir aussi :** `…/2026-06-14-wiki-master-design.md`, modèle Savana, pattern « LLM Wiki ».

## Idée

L'analyse *profonde* (qualité Savana : pages riches, sectionnées, liées, sourcées) a été
produite, dans Savana, par un **agent externe** (Claude Code) lisant les chapitres et
maintenant des pages markdown. On reproduit cette voie : l'app **prépare** le dossier Univers
pour qu'un agent externe puisse faire ce travail, en générant un fichier d'instructions
`wiki/CLAUDE.md` (le « schéma » du pattern LLM Wiki) + en garantissant la structure.

C'est le chemin le **plus rapide vers le résultat Savana** et le moins risqué (aucun appel IA
in-app). L'intégration continue in-app et l'interrogation viennent dans des slices suivantes.

## Portée (cette slice)

- Générer `<projet>.palim/wiki/CLAUDE.md` : le mode d'emploi complet pour un agent qui
  maintient l'Univers à partir du manuscrit.
- Un déclencheur UI dans la section Univers : bouton **« Préparer l'analyse approfondie
  (agent externe) »** → écrit le fichier + crée les dossiers de catégories vides au besoin +
  notification indiquant le chemin (et, si dispo, révéler dans le Finder).

**Hors périmètre :** l'analyse elle-même (faite par l'agent externe), l'intégration continue
in-app, l'interrogation, le panneau droit complet.

## Le contenu de `wiki/CLAUDE.md` (généré)

Document en français, à destination d'un agent (Claude Code) lancé sur `<projet>.palim/`.
Sections :

1. **Rôle & charte** : tu maintiens la « bible » (Univers) du roman — du matériel de
   RÉFÉRENCE, distinct de la prose. Tu n'écris JAMAIS de prose de manuscrit. Tu n'inventes
   rien ; tout fait repose sur le texte.
2. **Sources (lecture seule)** : les chapitres du manuscrit sont sous `../chapitres/*.md`
   (frontmatter `id`/`title` + corps ; scènes séparées par `* * *`). Ne JAMAIS les modifier.
3. **Structure de l'Univers** (ce que tu écris) :
   ```
   wiki/
     personnages/  lieux/  intrigues/  structure/  ecriture/  notes/   (un .md par fiche)
     _alertes/<uuid>.md     log.md     index.md     integrations.json
   ```
4. **Format d'une fiche** (CONTRAT pour que l'app la relise) — frontmatter YAML exact :
   ```yaml
   ---
   titre: <Titre lisible>
   categorie: <personnages|lieux|intrigues|structure|ecriture|notes>
   cree: AAAA-MM-JJ
   last_updated: AAAA-MM-JJ
   sources: [chapitres/001-....md, chapitres/004-....md]
   type: <optionnel: mystere|chronologie|etat_connaissance|pov|voix_personnage>
   tags: [optionnel]
   ---
   # <Titre>
   ## Résumé … (avec des [[liens]] vers d'autres fiches)
   ## <sections riches : traits, scènes datées par chapitre, citations…>
   ```
   Le **slug = nom de fichier** (sans accents, minuscule, tirets). Les `[[cible]]` /
   `[[cible|affichage]]` relient les fiches (résolus par chemin `cat/slug`, slug unique, ou
   titre).
5. **Le mécanisme `sources:`** (cœur de l'update incrémental) : avant d'ingérer un chapitre
   dans une fiche, vérifier s'il est déjà dans `sources:` ; sinon, ajouter le contenu ET le
   chapitre à `sources:`. Pour trouver le backlog : comparer `ls ../chapitres/*.md` aux
   `sources:` de toutes les fiches.
6. **Grille de lecture (8 points)** : (réutiliser la grille de `ingestPrompt.ts` —
   personnages / lieux / intrigues / contradictions / noms manquants / incertitudes /
   chronologie / états de connaissance).
7. **Conventions** : tout en français ; marquer l'incertain « (non vérifié) » ; **préserver
   les ambiguïtés** ; placeholders (XXX, TROUVER NOM) **signalés, jamais inventés** ; **ne
   jamais supprimer** une contradiction → documenter les deux versions avec leurs sources +
   créer une **alerte** (`_alertes/<uuid>.md`) ; **pas de tirets cadratins** (— ), tirets
   simples (-).
8. **Opérations** :
   - *Ingest d'un chapitre* : lire le chapitre, appliquer la grille, créer/mettre à jour les
     fiches affectées (+ `sources:`), créer des alertes si contradiction, appendre à `log.md`,
     mettre à jour `index.md`, marquer le chapitre dans `integrations.json` (id → datetime ISO).
   - *Audit par lots* (import / rattrapage) : diff backlog ; regrouper par thème ; **agents
     Explore parallèles** (un par lot de 6-8 chapitres) ; consolider.
   - *Répondre à une question* : synthétiser depuis les fiches + chapitres, citer les sources,
     ne pas halluciner.
9. **index.md** : catalogue par catégorie (titre + résumé + lien), maintenu à chaque ingest.
10. **log.md** : journal append-only, plus récent en tête, format `## AAAA-MM-JJ - <ACTION> <sujet>`.

## Architecture (unités)

- **`src/shared/wiki/agentDoc.ts`** (pur, testable) : `buildWikiAgentDoc(projectName: string,
  author: string): string` → le contenu complet du `CLAUDE.md`. Réutilise la grille 8 points
  (export depuis `ingestPrompt.ts` ou copie locale).
- **Écriture** : action renderer (dans `wikiStore` ou `wikiIO`) `prepareAgentAnalysis(projectPath, project)` :
  crée `wiki/` + les 6 dossiers de catégories (vides, pour guider l'agent) + écrit
  `wiki/CLAUDE.md`. Notification du chemin.
- **UI** : bouton dans la section Univers (en-tête du navigateur ou zone dédiée) « Préparer
  l'analyse approfondie (agent externe) ». Au clic : `prepareAgentAnalysis` + notification ;
  si une IPC « révéler dans le Finder » existe (`shell.openPath`), l'utiliser, sinon afficher
  le chemin à copier.

## Gestion d'erreurs
- Pas de projet → bouton désactivé.
- Échec d'écriture → notification d'erreur (réutiliser `statsStore.showNotification`).
- Réécriture : régénère `CLAUDE.md` (idempotent ; n'écrase aucune fiche existante).

## Tests
- **`buildWikiAgentDoc`** (`node:test`, pur) : contient le nom du projet ; les 6 catégories ;
  le contrat de frontmatter (`titre`/`categorie`/`sources`) ; les 8 points de la grille ;
  les conventions clés (« (non vérifié) », « ne jamais supprimer » une contradiction, pas de
  cadratin) ; la référence `../chapitres/`.
- **Manuel** : cliquer le bouton → `wiki/CLAUDE.md` créé + dossiers de catégories ; lancer
  `claude` dans `<projet>.palim/` → l'agent comprend et peut commencer à bâtir l'Univers.

## Hors périmètre (rappel)
Analyse in-app, intégration continue, interrogation, panneau droit, dashboards.
