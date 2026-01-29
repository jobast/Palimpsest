import { app, BrowserWindow, ipcMain, dialog, nativeImage, session, Menu, safeStorage } from 'electron'
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

type AIProvider = 'claude' | 'openai' | 'ollama'

interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface AIChatRequest {
  provider: AIProvider
  model: string
  messages: AIMessage[]
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  ollamaConfig?: {
    endpoint: string
    model: string
  }
}

interface StoredAIKeysFile {
  encrypted: boolean
  claude?: string
  openai?: string
  updatedAt?: string
}

const AI_KEYS_FILENAME = 'ai-keys.json'

function getAIKeysPath(): string {
  return path.join(app.getPath('userData'), AI_KEYS_FILENAME)
}

async function readStoredAIKeys(): Promise<StoredAIKeysFile> {
  const keysPath = getAIKeysPath()
  try {
    const raw = await fs.promises.readFile(keysPath, 'utf-8')
    const parsed = JSON.parse(raw) as StoredAIKeysFile
    return parsed
  } catch {
    return { encrypted: safeStorage.isEncryptionAvailable() }
  }
}

async function writeStoredAIKeys(data: StoredAIKeysFile): Promise<void> {
  const keysPath = getAIKeysPath()
  const payload = JSON.stringify(data, null, 2)
  await fs.promises.writeFile(keysPath, payload, 'utf-8')
}

function encryptKey(plain: string): { value: string; encrypted: boolean } {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(plain).toString('base64')
    return { value: encrypted, encrypted: true }
  }
  const encoded = Buffer.from(plain, 'utf-8').toString('base64')
  return { value: encoded, encrypted: false }
}

function decryptKey(value: string, encrypted: boolean): string {
  const buf = Buffer.from(value, 'base64')
  if (encrypted && safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(buf)
  }
  return buf.toString('utf-8')
}

function keyHint(key: string): string {
  const trimmed = key.trim()
  if (trimmed.length <= 4) return trimmed
  return `••••${trimmed.slice(-4)}`
}

async function getKeyForProvider(provider: AIProvider): Promise<string | null> {
  const stored = await readStoredAIKeys()
  const encrypted = stored.encrypted
  if (provider === 'claude' && stored.claude) {
    return decryptKey(stored.claude, encrypted)
  }
  if (provider === 'openai' && stored.openai) {
    return decryptKey(stored.openai, encrypted)
  }
  return null
}

async function chatClaude(request: AIChatRequest, apiKey: string) {
  const { model, messages, maxTokens = 4096, temperature = 0.7, systemPrompt } = request
  const systemMessage = systemPrompt || messages.find(m => m.role === 'system')?.content
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }))

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemMessage,
      messages: chatMessages
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
    throw new Error(error.error?.message || `Claude API error: ${response.status}`)
  }

  const data = await response.json()

  return {
    content: data.content?.[0]?.text || '',
    tokensUsed: {
      input: data.usage?.input_tokens || 0,
      output: data.usage?.output_tokens || 0
    },
    model: data.model
  }
}

async function chatOpenAI(request: AIChatRequest, apiKey: string) {
  const { model, messages, maxTokens = 4096, temperature = 0.7, systemPrompt } = request
  const allMessages = systemPrompt
    ? [{ role: 'system' as const, content: systemPrompt }, ...messages.filter(m => m.role !== 'system')]
    : messages

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: allMessages.map(m => ({
        role: m.role,
        content: m.content
      }))
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
    throw new Error(error.error?.message || `OpenAI API error: ${response.status}`)
  }

  const data = await response.json()

  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensUsed: {
      input: data.usage?.prompt_tokens || 0,
      output: data.usage?.completion_tokens || 0
    },
    model: data.model
  }
}

async function chatOllama(request: AIChatRequest) {
  const { messages, maxTokens = 4096, temperature = 0.7, systemPrompt, ollamaConfig } = request
  if (!ollamaConfig) {
    throw new Error('Configuration Ollama manquante')
  }

  const allMessages = systemPrompt
    ? [{ role: 'system' as const, content: systemPrompt }, ...messages.filter(m => m.role !== 'system')]
    : messages

  const response = await fetch(`${ollamaConfig.endpoint}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: ollamaConfig.model,
      messages: allMessages.map(m => ({
        role: m.role,
        content: m.content
      })),
      options: {
        temperature,
        num_predict: maxTokens
      },
      stream: false
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || `Ollama API error: ${response.status}`)
  }

  const data = await response.json()

  const inputText = allMessages.map(m => m.content).join(' ')
  const outputText = data.message?.content || ''
  const estimatedInputTokens = Math.ceil(inputText.length / 4)
  const estimatedOutputTokens = Math.ceil(outputText.length / 4)

  return {
    content: outputText,
    tokensUsed: {
      input: data.prompt_eval_count || estimatedInputTokens,
      output: data.eval_count || estimatedOutputTokens
    },
    model: ollamaConfig.model
  }
}

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

// PDF Export using Electron's printToPDF
ipcMain.handle('export:printToPDF', async (_, options: {
  pageWidth: number // in microns
  pageHeight: number // in microns
  margins: { top: number; bottom: number; left: number; right: number } // in microns
}) => {
  if (!mainWindow) {
    return { success: false, error: 'No window available' }
  }

  try {
    const pdfData = await mainWindow.webContents.printToPDF({
      pageSize: {
        width: options.pageWidth,
        height: options.pageHeight
      },
      margins: {
        top: options.margins.top / 1000, // Convert microns to mm for Electron
        bottom: options.margins.bottom / 1000,
        left: options.margins.left / 1000,
        right: options.margins.right / 1000
      },
      printBackground: true,
      printSelectionOnly: false
    })

    return { success: true, data: pdfData }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// Save PDF file
ipcMain.handle('export:savePDF', async (_, data: Buffer, defaultFilename: string) => {
  if (!mainWindow) {
    return { success: false, error: 'No window available' }
  }

  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultFilename,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Cancelled' }
    }

    await fs.promises.writeFile(result.filePath, data)
    return { success: true, filePath: result.filePath }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// AI key management
ipcMain.handle('ai:getKeyStatus', async () => {
  const stored = await readStoredAIKeys()
  const encrypted = stored.encrypted
  const claudeKey = stored.claude ? decryptKey(stored.claude, encrypted) : ''
  const openaiKey = stored.openai ? decryptKey(stored.openai, encrypted) : ''

  return {
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    hasClaudeKey: Boolean(claudeKey),
    hasOpenaiKey: Boolean(openaiKey),
    claudeKeyHint: claudeKey ? keyHint(claudeKey) : null,
    openaiKeyHint: openaiKey ? keyHint(openaiKey) : null
  }
})

ipcMain.handle('ai:setApiKey', async (_event, payload: { provider: AIProvider; key: string }) => {
  const { provider, key } = payload
  const stored = await readStoredAIKeys()
  const updated: StoredAIKeysFile = {
    encrypted: stored.encrypted
  }

  if (provider === 'claude') {
    if (key && key.trim().length > 0) {
      const encryptedKey = encryptKey(key.trim())
      updated.encrypted = encryptedKey.encrypted
      updated.claude = encryptedKey.value
      updated.openai = stored.openai
    } else {
      updated.openai = stored.openai
    }
  }

  if (provider === 'openai') {
    if (key && key.trim().length > 0) {
      const encryptedKey = encryptKey(key.trim())
      updated.encrypted = encryptedKey.encrypted
      updated.openai = encryptedKey.value
      updated.claude = stored.claude
    } else {
      updated.claude = stored.claude
    }
  }

  updated.updatedAt = new Date().toISOString()

  await writeStoredAIKeys(updated)

  return { success: true }
})

ipcMain.handle('ai:clearApiKey', async (_event, payload: { provider: AIProvider }) => {
  const { provider } = payload
  const stored = await readStoredAIKeys()
  const updated: StoredAIKeysFile = {
    encrypted: stored.encrypted,
    claude: provider === 'claude' ? undefined : stored.claude,
    openai: provider === 'openai' ? undefined : stored.openai,
    updatedAt: new Date().toISOString()
  }

  await writeStoredAIKeys(updated)
  return { success: true }
})

ipcMain.handle('ai:chat', async (_event, request: AIChatRequest) => {
  const { provider } = request

  if (provider === 'ollama') {
    return chatOllama(request)
  }

  const apiKey = await getKeyForProvider(provider)
  if (!apiKey) {
    throw new Error(`Cle API manquante pour ${provider}`)
  }

  if (provider === 'claude') {
    return chatClaude(request, apiKey)
  }

  return chatOpenAI(request, apiKey)
})
