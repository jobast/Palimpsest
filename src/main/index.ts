import { app, BrowserWindow, ipcMain, dialog, nativeImage, session, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createApplicationMenu } from './menu'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Set app name for macOS menu bar (must be before app.whenReady)
app.setName('Palimpseste')

let mainWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV !== 'production'

function createWindow() {
  // Set dock icon on macOS during development
  if (process.platform === 'darwin') {
    const iconPath = isDev
      ? path.join(__dirname, '../../build/icon.png')
      : path.join(__dirname, '../build/icon.png')

    if (fs.existsSync(iconPath)) {
      const icon = nativeImage.createFromPath(iconPath)
      app.dock.setIcon(icon)
    }
  }
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 }
  })

  // Configure spell checker for French
  session.defaultSession.setSpellCheckerLanguages(['fr'])

  // Handle ALL context menus in the editor with native Electron menu
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menuItems: Electron.MenuItemConstructorOptions[] = []

    // Spell check suggestions (if misspelled word)
    if (params.misspelledWord) {
      if (params.dictionarySuggestions.length > 0) {
        params.dictionarySuggestions.slice(0, 5).forEach((suggestion) => {
          menuItems.push({
            label: suggestion,
            click: () => mainWindow?.webContents.replaceMisspelling(suggestion)
          })
        })
      } else {
        menuItems.push({ label: 'Aucune suggestion', enabled: false })
      }
      menuItems.push({ type: 'separator' })
      menuItems.push({
        label: 'Ajouter au dictionnaire',
        click: () => mainWindow?.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      })
      menuItems.push({ type: 'separator' })
    }

    // Standard edit options
    if (params.editFlags.canCut || params.editFlags.canCopy) {
      menuItems.push(
        { label: 'Couper', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copier', role: 'copy', enabled: params.editFlags.canCopy }
      )
    }
    menuItems.push({ label: 'Coller', role: 'paste', enabled: params.editFlags.canPaste })

    // Only show menu if we have items
    if (menuItems.length > 0) {
      const menu = Menu.buildFromTemplate(menuItems)
      menu.popup()
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Create application menu
  createApplicationMenu(mainWindow)
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers for file operations
ipcMain.handle('dialog:openProject', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'treatPackageAsDirectory'],
    message: 'Sélectionnez un dossier de projet Palimpseste (.palim)'
  })
  return result
})

ipcMain.handle('dialog:saveProject', async () => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    filters: [{ name: 'Palimpseste Project', extensions: ['palim'] }]
  })
  return result
})

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    return { success: true, content }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('fs:createDirectory', async (_, dirPath: string) => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true })
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('fs:readDirectory', async (_, dirPath: string) => {
  try {
    const files = await fs.promises.readdir(dirPath, { withFileTypes: true })
    return {
      success: true,
      files: files.map(f => ({
        name: f.name,
        isDirectory: f.isDirectory()
      }))
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('fs:exists', async (_, filePath: string) => {
  try {
    await fs.promises.access(filePath)
    return true
  } catch {
    return false
  }
})

// Spell check IPC handlers
ipcMain.handle('spellcheck:addToDictionary', async (_, word: string) => {
  session.defaultSession.addWordToSpellCheckerDictionary(word)
  return true
})

ipcMain.handle('spellcheck:replaceMisspelling', async (_, word: string) => {
  if (mainWindow) {
    mainWindow.webContents.replaceMisspelling(word)
  }
  return true
})
