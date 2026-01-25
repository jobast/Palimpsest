import { Menu, BrowserWindow, app, shell } from 'electron'

const isMac = process.platform === 'darwin'

// Helper to safely send IPC messages to the window
function sendToWindow(mainWindow: BrowserWindow, channel: string) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel)
  }
}

export function createApplicationMenu(mainWindow: BrowserWindow) {
  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: 'Palimpseste',
      submenu: [
        { role: 'about' as const, label: 'A propos de Palimpseste' },
        { type: 'separator' as const },
        { role: 'services' as const, label: 'Services' },
        { type: 'separator' as const },
        { role: 'hide' as const, label: 'Masquer Palimpseste' },
        { role: 'hideOthers' as const, label: 'Masquer les autres' },
        { role: 'unhide' as const, label: 'Tout afficher' },
        { type: 'separator' as const },
        { role: 'quit' as const, label: 'Quitter Palimpseste' }
      ]
    }] : []),

    // File menu
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Nouveau projet',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            sendToWindow(mainWindow, 'menu:new-project')
          }
        },
        {
          label: 'Ouvrir...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            sendToWindow(mainWindow, 'menu:open-project')
          }
        },
        { type: 'separator' },
        {
          label: 'Enregistrer',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            sendToWindow(mainWindow, 'menu:save-project')
          }
        },
        { type: 'separator' },
        {
          label: 'Exporter',
          submenu: [
            {
              label: 'Exporter en Word (.docx)',
              accelerator: 'CmdOrCtrl+Shift+E',
              click: () => {
                sendToWindow(mainWindow, 'menu:export-docx')
              }
            },
            {
              label: 'Exporter en PDF',
              accelerator: 'CmdOrCtrl+Shift+P',
              click: () => {
                sendToWindow(mainWindow, 'menu:export-pdf')
              }
            }
          ]
        },
        { type: 'separator' },
        isMac
          ? { role: 'close' as const, label: 'Fermer' }
          : { role: 'quit' as const, label: 'Quitter' }
      ]
    },

    // Edit menu
    {
      label: 'Edition',
      submenu: [
        { role: 'undo' as const, label: 'Annuler' },
        { role: 'redo' as const, label: 'Retablir' },
        { type: 'separator' },
        { role: 'cut' as const, label: 'Couper' },
        { role: 'copy' as const, label: 'Copier' },
        { role: 'paste' as const, label: 'Coller' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const, label: 'Coller sans mise en forme' },
          { role: 'delete' as const, label: 'Supprimer' },
          { role: 'selectAll' as const, label: 'Selectionner tout' },
        ] : [
          { role: 'delete' as const, label: 'Supprimer' },
          { type: 'separator' as const },
          { role: 'selectAll' as const, label: 'Selectionner tout' }
        ])
      ]
    },

    // View menu
    {
      label: 'Affichage',
      submenu: [
        { role: 'zoomIn' as const, label: 'Zoom avant' },
        { role: 'zoomOut' as const, label: 'Zoom arriere' },
        { role: 'resetZoom' as const, label: 'Taille reelle' },
        { type: 'separator' },
        {
          label: 'Mode concentration',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => {
            sendToWindow(mainWindow, 'menu:toggle-focus-mode')
          }
        },
        { role: 'togglefullscreen' as const, label: 'Plein ecran' },
        { type: 'separator' },
        { role: 'toggleDevTools' as const, label: 'Outils developpeur' }
      ]
    },

    // Window menu
    {
      label: 'Fenetre',
      submenu: [
        { role: 'minimize' as const, label: 'Minimiser' },
        { role: 'zoom' as const, label: 'Zoom' },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const, label: 'Tout au premier plan' },
          { type: 'separator' as const },
          { role: 'window' as const, label: 'Fenetre' }
        ] : [
          { role: 'close' as const, label: 'Fermer' }
        ])
      ]
    },

    // Help menu
    {
      role: 'help' as const,
      label: 'Aide',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/palimpseste/palimpseste')
          }
        },
        ...(!isMac ? [
          { type: 'separator' as const },
          { role: 'about' as const, label: 'A propos' }
        ] : [])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
