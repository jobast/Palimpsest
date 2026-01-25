# Palimpseste

Traitement de texte pour écrivains. Application Electron + React.

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
