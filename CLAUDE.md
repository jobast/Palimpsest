# Palimpseste

Traitement de texte pour écrivains. Application Electron + React.

## Concept

Outil d'écriture de romans/manuscrits avec :
- **Pagination visuelle** en temps réel (comme un vrai livre, pas un scroll infini)
- **Templates de formats** : poche français, grand format, US trade, manuscrit dactylographié...
- **Structure du manuscrit** : chapitres, scènes, organisation hiérarchique
- **Fiches** : personnages, lieux (avec géolocalisation), intrigues, notes
- **Export** : DOCX, PDF aux normes éditoriales

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
