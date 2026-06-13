# Plan d'upgrade Palimpseste (Electron) — fonctionnalités issues de la version Qt

**Date :** 2026-06-13
**Contexte :** retour à la version **Electron** (`/Users/saidimu/DEV/PROJETS/palimpseste`) comme base active. La version **Qt/PySide6** (`palimpseste-qt`) a été le terrain d'invention de plusieurs fonctionnalités qui n'existent pas (ou seulement partiellement) côté Electron. Ce document les inventorie pour les **porter** dans Electron/React.

**Légende état Electron :** ✅ existe · 🟡 partiel · ⬜ absent

---

## 0. Priorités demandées

1. **Modèles IA** (multi-provider) — §A
2. **Wiki / bible maintenu par LLM** — §B
3. **Gestion des dialogues** — §C
4. **Notes privées par chapitre** — §D

Puis les améliorations chapitres (§E) et le reste (§F).

---

## A. IA — multi-provider + charte éditoriale + personas

**État Electron : 🟡** — `aiStore.ts` gère déjà `claude | openai | ollama` avec suivi de coûts (`AIProvider` dans `shared/types/project.ts`), et `components/ai/` a des actions (editorialFeedback, characterAnalysis, plotAnalysis, manuscriptAnalysis). **Manquent** : les providers supplémentaires, la charte stricte « ne jamais écrire la prose », et les personas d'éditeur.

**À porter depuis Qt (`core/ai.py`) :**

- **Élargir la liste des providers** de 3 → 6+. Registre Qt (`PROVIDERS`) :
  | id | label | type | base_url | env var | modèles (défaut en gras) |
  |---|---|---|---|---|---|
  | `anthropic` | Anthropic (Claude) | SDK natif | — | `ANTHROPIC_API_KEY` | **claude-fable-5**, claude-opus-4-8, claude-sonnet-4-6, claude-haiku-4-5-20251001 |
  | `openai` | OpenAI | openai-compat | api.openai.com/v1 | `OPENAI_API_KEY` | **gpt-5-mini**, gpt-5, gpt-4.1-mini |
  | `mistral` | Mistral | openai-compat | api.mistral.ai/v1 | `MISTRAL_API_KEY` | **mistral-medium-latest**, large, small |
  | `deepseek` | DeepSeek | openai-compat | api.deepseek.com | `DEEPSEEK_API_KEY` | **deepseek-chat**, deepseek-reasoner |
  | `qwen` | Qwen | openai-compat | dashscope-intl…/compatible-mode/v1 | `DASHSCOPE_API_KEY` | **qwen-plus**, max, turbo |
  | `gemini` | Google Gemini | openai-compat | generativelanguage…/v1beta/openai/ | `GEMINI_API_KEY` | **gemini-2.5-flash**, pro |
  - Tous les non-Anthropic passent par une API **OpenAI-compatible** (un seul code-chemin paramétré par `base_url`).
  - Quirk OpenAI : GPT-5 / séries « o » exigent `max_completion_tokens` au lieu de `max_tokens`.
- **Charte éditoriale stricte** (`SYSTEM_PROMPT`, Qt) : l'IA **diagnostique, commente, oriente** mais **n'écrit jamais** ni ne réécrit la prose ; elle cite de courts extraits. À injecter dans **chaque** prompt, tous providers. Cf. mémoire [[palimpseste-ai-charter]]. Côté UI : **aucune** affordance pour insérer la sortie IA dans le manuscrit (garde architecturale).
- **Flag `charter_note`** : pour les modèles économiques (tous sauf Anthropic), afficher l'avertissement « les modèles économiques peuvent suivre la charte moins strictement ».
- **4 personas d'éditeur** (`PERSONAS`, Qt) : `litteraire`, `grand_public`, `poche`, `comite` — chacun = une voix/grille de lecture distincte pour la réaction simulée d'un éditeur.
- **3 actions de conseil** : `build_editorial_review` (note structurée : Forces → Faiblesses → Rythme/structure → Personnages/voix → Pistes), `build_editor_persona(persona)`, `build_selection_advice` (sur passage surligné, avec question optionnelle de l'auteur).
- **Stockage des clés** : trousseau OS (lib `keyring` côté Qt ; côté Electron → `safeStorage` d'Electron ou keytar). **Jamais** dans un fichier projet ni les settings ; fallback lecture sur la variable d'env.
- **Streaming** : Qt streame les chunks (thread + signaux). Côté Electron : streamer via IPC depuis le main process (déjà la voie utilisée pour l'IA).

---

## B. Wiki / bible du roman maintenu par LLM  ⬜ (net-new — différenciateur produit)

**État Electron : ⬜** — Electron a des « fiches » manuelles (`sheets`: characters/locations/plots/notes) + des « rapports IA », mais **pas** la bible vivante maintenue par LLM avec file de suggestions, alertes, liens et graphe. C'est **la** feature différenciante (façon « Savana »).

**À porter depuis Qt (`core/wiki*.py`, `ui/wiki_panel.py`, `ui/fiches_panel.py`) :**

- **Concept** : base de référence de l'univers (personnages, lieux, intrigues, structure, écriture, notes), distincte de la prose. L'IA **propose** des mises à jour ; l'auteur **accepte/refuse** chaque proposition. Aucune écriture IA ne touche le manuscrit.
- **Catégories** : `personnages, lieux, intrigues, structure, ecriture, notes`.
- **Format disque** (sous `<projet>/wiki/`) — Markdown + front matter, écritures atomiques :
  ```
  wiki/
    personnages/<slug>.md   (front matter: titre, categorie, cree, last_updated, sources[], type?)
    lieux/… intrigues/… structure/… ecriture/… notes/…
    _suggestions/<uuid>.md  (type: nouvelle_fiche|ajout|incoherence ; cible, titre, resume, source_chapitre)
    _alertes/<uuid>.md      (type: contradiction|nom_manquant|decision|autre ; statut: ouverte|resolue)
    log.md                  (journal, plus récent en tête)
    integrations.json       (chapter_id → datetime ISO de dernière intégration)
  ```
- **Pipeline LLM « intégrer un chapitre à la bible »** (`maintain_chapter`) : texte du chapitre + résumé des fiches existantes + « déjà connu » (suggestions/alertes en cours, anti-doublon) + résumé des mystères + **grille de lecture en 8 points** (personnages, lieux, intrigues, contradictions, noms manquants, incertitudes, chronologie, états de connaissance). Sortie en blocs `=== SUGGESTION ===` (`TYPE/CIBLE/TITRE/RESUME/CORPS`) ou `AUCUNE SUGGESTION`. Badge « À intégrer : N chapitre(s) » + bouton « Tout intégrer » (diff via `integrations.json`).
- **Acceptation** : `nouvelle_fiche` → crée la fiche ; `ajout` → ajoute une section datée à la fiche ; `incoherence` → crée une **Alerte** persistante (ne modifie jamais une fiche).
- **Wikilinks** `[[cible]]` / `[[cible|affichage]]`, résolution (chemin exact → slug unique → titre insensible casse/accents), backlinks, **graphe** (nœuds = fiches, arêtes = liens, couleur par catégorie, double-clic = navigation).
- **Recherche plein-texte** (fiches + manuscrit), normalisée accents/casse, scorée, snippets ~120 car., scope Bible/Manuscrit/Les deux, debounce 300 ms.
- **« Interroger la bible »** (`ask_bible`) : sélection de contexte pertinent (budget ~140k car., cap 30 docs) + prompt strict « référence seulement, cite les sources, marque les incertitudes, ne réécris jamais ». Réponse sauvegardable en fiche `notes`.
- **6 templates** : `mystere`, `chronologie`, `etat_connaissance`, `pov`, `voix_personnage`, `libre`. Le template `mystere` (sections Question / Indices / Fausses pistes / Révélation / Statut) alimente un tableau de bord **Structure** (`mysteries_overview`) + **index des scènes** (qui apparaît où + nb mots).
- **Réconciliation modèle** : côté Electron, décider si la « bible LLM » remplace ou complète les `sheets` actuels (recommandation : la bible Markdown devient la source ; les `sheets` JSON deviennent une vue ou sont migrés).

---

## C. Gestion des dialogues  🟡

**État Electron : 🟡** — il existe une extension `editor/extensions/DialogueDash.ts` (+ `FrenchSpaces.ts`), mais **pas** le style de dialogue par projet ni la quantification.

**À porter depuis Qt (`core/dialogue.py`) :**

- **3 styles par projet** (champ `dialogueStyle` dans le manifeste, défaut `cadratin`) :
  | clé | label | début de ligne | ouverture inline | guillemets |
  |---|---|---|---|---|
  | `cadratin` | Tiret cadratin (—) | oui | `— ` (— + U+00A0) | `« ` … ` »` (U+00A0) |
  | `guillemets` | Guillemets français (« ») | non | `« ` (« + **U+202F** fine insécable) | `« ` … ` »` (U+202F) |
  | `anglais` | Guillemets anglais (" ") | non | `"` (U+201C) | `"` … `"` |
  - **Nuance clé** : `cadratin` utilise U+00A0 ; `guillemets` utilise **U+202F** (fine insécable), norme typo française.
- **Insertion** : action « Ouvrir un dialogue » qui insère le bon préfixe selon le style (Qt : `insert_open_dialogue`).
- **Quantification** (`dialogue_stats`) : compte mots de **dialogue** vs **narration** et `dialogue_ratio`, par chapitre et global. Détection selon le style (lignes commençant par `—` ; spans `« … »` ; spans `" … "`). À afficher dans le panneau stats.

---

## D. Notes privées par chapitre  ⬜

**État Electron : ⬜** — le modèle `ManuscriptItem` n'a pas de champ note privée de chapitre (il y a des « fiches » de type note, mais pas la note attachée au chapitre, hors manuscrit).

**À porter depuis Qt (`Chapter.note`, `set_chapter_note`, `NoteEditor`) :**

- Champ `note: string` sur le chapitre, **jamais** intercalé dans le manuscrit ni dans les exports (PDF/DOCX).
- Révélée seulement sur action (clic dédié) dans un éditeur de note au centre ; pas de session/stat associée.
- Dans l'arbre : **pas de ligne « Note » par défaut** — elle n'apparaît que si une note existe (cf. §E menu : « Ajouter une note »).

---

## E. Améliorations chapitres (réalisées en Qt, PR #1 `palimpseste-qt`)

**État Electron : 🟡** — l'arbre `Sidebar.tsx` gère déjà chapitres/scènes (+ renommage inline, statut, dupliquer, ajouter scène). À aligner sur le comportement Qt :

- **Titre de chapitre éditable en MAJUSCULE** en tête de la 1ʳᵉ section, synchronisé arbre ↔ éditeur, **exclu** du contenu stocké (le titre vit dans le modèle ; l'export le régénère). NB : côté Electron il existe déjà un node `chapterTitle` (`ParagraphStyles`) — base réutilisable.
- **Menu contextuel** complet : Renommer · Ajouter une section · Ajouter une note · Intégrer à la bible.
- **Réordonnancement des chapitres par glisser-déposer** (Electron : DnD React ; le store a déjà `reorderManuscriptItems`).
- **Vocabulaire** : « scène » → « section » dans l'UI (optionnel, cohérence avec Qt).

---

## F. Autres fonctionnalités Qt notables

| Feature | Qt (source) | État Electron | Note de portage |
|---|---|---|---|
| **Presets de format éditorial** | `core/formats.py` (8 presets : poche-fr, grand-format, us-trade, manuscrit, roman-broche, a5, digest-us, manuscrit-times) | ✅ `shared/types/templates.ts` | Compléter la liste si besoin ; aligner stacks de polices |
| **Surcharges de style projet** | `DocumentStyle` (familles, taille, interligne, marges) | 🟡 `UserTypographyOverrides` | Étendre aux marges/familles |
| **Analyse de style (sans IA)** | `core/analysis.py` (5 types : phrase_longue, adverbe, voix_passive, repetition, mot_faible + métriques) | 🟡 `lib/analysis/sentenceAnalyzer.ts` | Vérifier la parité des 5 détecteurs + navigation/surlignage |
| **Typo française auto** | `paged_editor` (« » fines, —, …, espaces hautes) | ✅ `FrenchSpaces.ts` | OK ; vérifier U+202F |
| **Stats & sessions** | `core/stats.py` (sessions JSONL, mots/jour, streak, objectif) | ✅ statsStore + charts | OK |
| **Teintes papier / dark mode** | blanc/crème/sépia, clair/sombre | ? | À vérifier |
| **Mode concentration** | Ctrl+Shift+F | ? | À vérifier |
| **Rechercher/Remplacer** | `find_replace_bar` | ? | À vérifier |
| **Export DOCX/PDF** | `docx_export.py` / `document.py` (titre une seule fois depuis le modèle) | ✅ `docxExporter`/`pdfExporter` | **⚠ pagination = le vrai chantier** (voir ci-dessous) |

---

## G. Hors-périmètre de ce plan, mais bloquant : la PAGINATION

Le portage des features ci-dessus est indépendant du **problème central d'Electron** : la pagination qui « saute » (tiptap-pagination-plus). Ce point fait l'objet d'un travail dédié (piste : re-pagination *debounced* + **ancrage du scroll** sur bloc/caret, ou plugin de décorations custom). À traiter séparément.

---

## H. Ordre de portage suggéré

1. **IA multi-provider + charte + personas** (§A) — valeur immédiate, risque faible, briques déjà présentes.
2. **Notes chapitre** (§D) + **améliorations chapitres** (§E) — petits, autonomes.
3. **Dialogues** (§C) — petit, autonome ; attention U+202F.
4. **Wiki/bible LLM** (§B) — le plus gros morceau et le différenciateur ; à faire en sous-jalons (modèle disque → intégration LLM → liens/graphe → recherche → interroger → structure).
5. **Pagination robuste** (§G) — chantier parallèle, prioritaire pour la qualité perçue.

> Chaque item devrait passer par son propre cycle brainstorming → spec → plan → implémentation.
