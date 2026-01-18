import { contextBridge, ipcRenderer } from 'electron'

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
  platform: process.platform
})
