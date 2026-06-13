# Launch Shortcuts

You can start the app either from npm scripts or by double-clicking `.command` files.

For a Dock/Finder icon launcher, generate native macOS `.app` shortcuts:
- `npm run launchers:build-macos`
- Output folder: `Launchers/`
- Main icon app: `Launchers/Palimpseste Launcher.app`
- You can drag this app to the Dock.

Double-click shortcuts (macOS):
- `Palimpseste.command`: menu (choose mode).
- `Palimpseste-Dev.command`: dev mode (`vite + electron`).
- `Palimpseste-Restart.command`: stop old dev processes, then relaunch.
- `Palimpseste-Electron.command`: launch Electron only (reuse existing dev server).
- `Palimpseste-RestartElectron.command`: restart Electron only (keep dev server running).
- `Palimpseste-ProdLocal.command`: local build + electron run.
- `Palimpseste-Packaged.command`: open packaged app or DMG from `release/`.

CLI equivalents:
- `npm run launch`
- `npm run launch:dev`
- `npm run launch:restart`
- `npm run launch:electron`
- `npm run launch:restart-electron`
- `npm run launch:prod-local`
- `npm run launch:packaged`
