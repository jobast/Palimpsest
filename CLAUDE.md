# Palimpseste

Traitement de texte pour écrivains. Application Electron + React.

## Concept

Outil d'écriture de romans/manuscrits avec :
- **Pagination visuelle** en temps réel (comme un vrai livre, pas un scroll infini)
- **Templates de formats** : poche français, grand format, US trade, manuscrit dactylographié...
- **Structure du manuscrit** : chapitres, scènes, organisation hiérarchique
- **Fiches** : personnages, lieux (avec géolocalisation), intrigues, notes
- **Statistiques** : mots écrits, temps d'écriture, objectifs, analyse de productivité
- **Correction avancée** : analyse stylistique, répétitions, adverbes, voix passive...
- **Export** : DOCX, PDF aux normes éditoriales

**Roadmap** : intégration IA comme assistant éditeur/écriture (suggestions, révisions, aide créative).

L'utilisateur voit son texte paginé exactement comme il sera imprimé.

## Stack

- **Frontend**: React 18, TypeScript, TailwindCSS
- **Editor**: TipTap avec tiptap-pagination-plus (pagination visuelle)
- **Desktop**: Electron
- **State**: Zustand (stores dans `src/renderer/stores/`)

## Structure

```
src/
  main/          # Process Electron principal
  preload/       # Bridge IPC
  renderer/      # App React
    components/  # UI (editor/, layout/, ui/)
    stores/      # État global (projectStore, editorStore, uiStore...)
    lib/         # Utilitaires (pagination/, export/)
  shared/        # Types partagés
```

## Commandes

```bash
npm run dev      # Dev avec hot reload
npm run build    # Build production
npm run preview  # Preview Electron
```

## Conventions

- Interface en **français**
- Commits en anglais
- Pas de fichiers doc sauf si demandé explicitement

## tiptap-pagination-plus

Extension TipTap pour la pagination visuelle. Structure DOM :

```html
<div class="ProseMirror rm-with-pagination">
  <div class="rm-page-break">           <!-- Container par page -->
    <div class="page">                   <!-- Zone de contenu (float!) -->
      <!-- Contenu texte ici -->
    </div>
    <div class="breaker">                <!-- Séparateur entre pages -->
      <div class="rm-page-footer">       <!-- Pied de page -->
      <div class="rm-pagination-gap">    <!-- Espace visuel -->
      <div class="rm-page-header">       <!-- En-tête page suivante -->
    </div>
  </div>
  <!-- ... autres .rm-page-break -->
</div>
```

**Important** :
- `.page` utilise `float`, donc `.rm-page-break` a **height: 0** (collapsed)
- Pour obtenir les dimensions réelles, utiliser `.page` avec `offsetWidth`/`offsetHeight`
- Les couleurs utilisent des CSS variables (`hsl(var(--paper))`) → problèmes avec html2canvas

## Virtualisation (documents longs)

Pour les documents > 10 pages, `PagedEditor.tsx` utilise `content-visibility: hidden` sur les pages hors écran.

- État `isExportingPdf` dans `uiStore` pour désactiver la virtualisation pendant l'export
- Toujours forcer `contentVisibility = 'visible'` avant capture

## Export PDF

Utilise html2canvas + jsPDF (`src/renderer/lib/export/pdfExporter.ts`).

**Défis connus** :
- html2canvas ne résout pas les CSS variables → forcer `color: #000` dans `onclone`
- Les éléments floatés ont height: 0 via `getBoundingClientRect()` → utiliser `offsetHeight`
- Désactiver virtualisation + reset zoom à 100% avant capture
