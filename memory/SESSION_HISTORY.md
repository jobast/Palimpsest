# Session History

_Append-only timeline of snapshots._
## 06/02/2026 08:46:39

- Summary: Checkpoint: memory system + launch shortcuts added; hardening lot already integrated
- Branch: main
- Head: c807c02
- Snapshot ID: 2026-02-06T08:46:39.409Z

### Completed
- Timer lifecycle singleton controller done
- IPC fs scope + realpath anti-symlink done
- DocumentId validation on writes done
- Atomic write + save recovery journal + tests done
- Preload CJS fix to restore window.electronAPI done

### In Progress
- Stabilizing UX for project open/save after recent hardening
- Add persistent collaboration memory and startup shortcuts

### Next
- Validate open/save flows manually in running Electron app
- If needed, add targeted fix for remaining open/save regressions
- Continue next P2 fixes (nested duplication and AI report typing)

### Risks
- Large dirty working tree may hide unrelated regressions
- Dialog/path checks can reject edge-case project folders

### Notes
- Lint/typecheck/build/test:main were passing before this checkpoint; re-run after this memory/launcher patch

### Git Status
```text
M package.json
 M src/main/index.ts
 M src/main/menu.ts
 M src/main/preload.ts
 M src/renderer/components/ai/AIPanel.tsx
 M src/renderer/components/ai/actions/editorialFeedback.ts
 M src/renderer/components/analysis/AnalysisPanel.tsx
 M src/renderer/components/editor/EditorArea.tsx
 M src/renderer/components/editor/extensions/FrenchSpaces.ts
 M src/renderer/components/editor/extensions/WordStats.ts
 M src/renderer/components/notifications/Toast.tsx
 M src/renderer/components/stats/charts/CumulativeProgressChart.tsx
 M src/renderer/components/stats/charts/ProductivityPatternChart.tsx
 M src/renderer/components/stats/charts/WordCountTrendChart.tsx
 M src/renderer/hooks/useExport.ts
 M src/renderer/hooks/usePagination.ts
 M src/renderer/hooks/useWritingTimer.ts
 M src/renderer/lib/analysis/sentenceAnalyzer.ts
 M src/renderer/lib/export/pdfExporter.ts
 M src/renderer/lib/pagination/paginationPlusAdapter.ts
 M src/renderer/lib/stats/calculations.ts
 M src/renderer/stores/analysisStore.ts
 M src/renderer/stores/projectStore.ts
 M src/shared/types/electron.d.ts
 M vite.config.ts
?? .eslintrc.cjs
?? LAUNCHERS.md
?? Palimpseste-Dev.command
?? Palimpseste-Packaged.command
?? Palimpseste-ProdLocal.command
?? Palimpseste-Restart.command
?? Palimpseste.command
?? memory/
?? scripts/launch-app.sh
?? scripts/session-memory.mjs
?? src/main/__tests__/
?? src/main/projectDialogs.ts
?? src/main/projectPaths.ts
?? src/main/saveRecovery.ts
```
## 06/02/2026 08:59:44

- Summary: Checkpoint: native macOS .app launchers generated
- Branch: main
- Head: c807c02
- Snapshot ID: 2026-02-06T08:59:44.626Z

### Completed
- Added native launcher builder script (macOS .app)
- Generated 5 app launchers with icon in Launchers/
- Added npm shortcut launchers:build-macos
- Updated launcher docs and gitignore for generated bundles

### In Progress
- Debug open/save regression in Electron flow

### Next
- Drag Launchers/Palimpseste Launcher.app to Dock and use it for relaunch
- Re-test project open/save in app and capture any remaining error
- Proceed to next P2 fixes after open/save is stable

### Risks
- Launcher apps hardcode project path /Users/saidimu/Dev/palimpseste (regenerate if project is moved)

### Notes
- Use npm run launchers:build-macos after icon/path changes

### Git Status
```text
M .gitignore
 M package.json
 M src/main/index.ts
 M src/main/menu.ts
 M src/main/preload.ts
 M src/renderer/components/ai/AIPanel.tsx
 M src/renderer/components/ai/actions/editorialFeedback.ts
 M src/renderer/components/analysis/AnalysisPanel.tsx
 M src/renderer/components/editor/EditorArea.tsx
 M src/renderer/components/editor/extensions/FrenchSpaces.ts
 M src/renderer/components/editor/extensions/WordStats.ts
 M src/renderer/components/notifications/Toast.tsx
 M src/renderer/components/stats/charts/CumulativeProgressChart.tsx
 M src/renderer/components/stats/charts/ProductivityPatternChart.tsx
 M src/renderer/components/stats/charts/WordCountTrendChart.tsx
 M src/renderer/hooks/useExport.ts
 M src/renderer/hooks/usePagination.ts
 M src/renderer/hooks/useWritingTimer.ts
 M src/renderer/lib/analysis/sentenceAnalyzer.ts
 M src/renderer/lib/export/pdfExporter.ts
 M src/renderer/lib/pagination/paginationPlusAdapter.ts
 M src/renderer/lib/stats/calculations.ts
 M src/renderer/stores/analysisStore.ts
 M src/renderer/stores/projectStore.ts
 M src/shared/types/electron.d.ts
 M vite.config.ts
?? .eslintrc.cjs
?? LAUNCHERS.md
?? Palimpseste-Dev.command
?? Palimpseste-Packaged.command
?? Palimpseste-ProdLocal.command
?? Palimpseste-Restart.command
?? Palimpseste.command
?? memory/
?? scripts/build-macos-launchers.sh
?? scripts/launch-app.sh
?? scripts/session-memory.mjs
?? src/main/__tests__/
?? src/main/projectDialogs.ts
?? src/main/projectPaths.ts
?? src/main/saveRecovery.ts
```
## 06/02/2026 15:51:18

- Summary: Stabilisation lancement Electron et relance dédiée
- Branch: main
- Head: c807c02
- Snapshot ID: 2026-02-06T15:51:18.385Z

### Completed
- Ajout lock instance unique Electron
- Ajout modes electron-only/restart-electron dans le launcher
- Régénération des launchers macOS avec icônes dédiées

### In Progress
- Surveillance stabilité runtime après ouverture projet

### Next
- Tester une session d'écriture prolongée (10+ min)
- Corriger warning Recharts key dans StatsPanel si besoin

### Risks
- Crashs passés potentiellement liés aux doubles instances dev

### Notes
- Utiliser launch:restart-electron pour relancer seulement la fenêtre

### Git Status
```text
M .gitignore
 M package.json
 M src/main/index.ts
 M src/main/menu.ts
 M src/main/preload.ts
 M src/renderer/components/ai/AIPanel.tsx
 M src/renderer/components/ai/actions/editorialFeedback.ts
 M src/renderer/components/analysis/AnalysisPanel.tsx
 M src/renderer/components/editor/EditorArea.tsx
 M src/renderer/components/editor/extensions/FrenchSpaces.ts
 M src/renderer/components/editor/extensions/WordStats.ts
 M src/renderer/components/notifications/Toast.tsx
 M src/renderer/components/stats/charts/CumulativeProgressChart.tsx
 M src/renderer/components/stats/charts/ProductivityPatternChart.tsx
 M src/renderer/components/stats/charts/WordCountTrendChart.tsx
 M src/renderer/hooks/useExport.ts
 M src/renderer/hooks/usePagination.ts
 M src/renderer/hooks/useWritingTimer.ts
 M src/renderer/lib/analysis/sentenceAnalyzer.ts
 M src/renderer/lib/export/pdfExporter.ts
 M src/renderer/lib/pagination/paginationPlusAdapter.ts
 M src/renderer/lib/stats/calculations.ts
 M src/renderer/stores/analysisStore.ts
 M src/renderer/stores/projectStore.ts
 M src/shared/types/electron.d.ts
 M vite.config.ts
?? .eslintrc.cjs
?? LAUNCHERS.md
?? Palimpseste-Dev.command
?? Palimpseste-Electron.command
?? Palimpseste-Packaged.command
?? Palimpseste-ProdLocal.command
?? Palimpseste-Restart.command
?? Palimpseste-RestartElectron.command
?? Palimpseste.command
?? memory/
?? scripts/build-macos-launchers.sh
?? scripts/launch-app.sh
?? scripts/session-memory.mjs
?? src/main/__tests__/
?? src/main/projectDialogs.ts
?? src/main/projectPaths.ts
?? src/main/saveRecovery.ts
```
