const { contextBridge, ipcRenderer } = require('electron')

console.log('Preload script loading...')

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
  }
})
