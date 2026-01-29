const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog operations
  openProject: () => ipcRenderer.invoke('dialog:openProject'),
  saveProject: () => ipcRenderer.invoke('dialog:saveProject'),

  // File system operations
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('fs:writeFile', filePath, content),
  createDirectory: (dirPath: string) =>
    ipcRenderer.invoke('fs:createDirectory', dirPath),
  readDirectory: (dirPath: string) =>
    ipcRenderer.invoke('fs:readDirectory', dirPath),
  exists: (filePath: string) => ipcRenderer.invoke('fs:exists', filePath),

  // App info
  platform: process.platform,

  // Spell check operations
  addToDictionary: (word: string) =>
    ipcRenderer.invoke('spellcheck:addToDictionary', word),
  replaceMisspelling: (word: string) =>
    ipcRenderer.invoke('spellcheck:replaceMisspelling', word),
  onSpellCheckContext: (callback: (data: { misspelledWord: string; suggestions: string[] }) => void) => {
    ipcRenderer.on('spellcheck:context', (_, data) => callback(data))
  },
  removeSpellCheckListener: () => {
    ipcRenderer.removeAllListeners('spellcheck:context')
  },

  // Menu action listeners
  onMenuAction: (callback: (action: string) => void) => {
    const actions = ['new-project', 'open-project', 'save-project', 'toggle-focus-mode', 'export-docx', 'export-pdf']
    actions.forEach(action => {
      ipcRenderer.on(`menu:${action}`, () => callback(action))
    })
  },

  removeMenuListeners: () => {
    const actions = ['new-project', 'open-project', 'save-project', 'toggle-focus-mode', 'export-docx', 'export-pdf']
    actions.forEach(action => {
      ipcRenderer.removeAllListeners(`menu:${action}`)
    })
  },

  // PDF Export
  printToPDF: (options: {
    pageWidth: number
    pageHeight: number
    margins: { top: number; bottom: number; left: number; right: number }
  }) => ipcRenderer.invoke('export:printToPDF', options),

  savePDF: (data: Buffer, defaultFilename: string) =>
    ipcRenderer.invoke('export:savePDF', data, defaultFilename),

  // AI key management + chat
  aiGetKeyStatus: () => ipcRenderer.invoke('ai:getKeyStatus'),
  aiSetApiKey: (provider: 'claude' | 'openai', key: string) =>
    ipcRenderer.invoke('ai:setApiKey', { provider, key }),
  aiClearApiKey: (provider: 'claude' | 'openai') =>
    ipcRenderer.invoke('ai:clearApiKey', { provider }),
  aiChat: (request: {
    provider: 'claude' | 'openai' | 'ollama'
    model: string
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
    maxTokens?: number
    temperature?: number
    systemPrompt?: string
    ollamaConfig?: { endpoint: string; model: string }
  }) => ipcRenderer.invoke('ai:chat', request)
})
