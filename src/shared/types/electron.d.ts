export interface FileResult {
  success: boolean
  content?: string
  error?: string
}

export interface DirectoryResult {
  success: boolean
  files?: Array<{ name: string; isDirectory: boolean }>
  error?: string
}

export interface DialogResult {
  canceled: boolean
  filePaths: string[]
}

export interface SaveDialogResult {
  canceled: boolean
  filePath?: string
}

export interface ElectronAPI {
  openProject: () => Promise<DialogResult>
  saveProject: () => Promise<SaveDialogResult>
  readFile: (filePath: string) => Promise<FileResult>
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  createDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>
  readDirectory: (dirPath: string) => Promise<DirectoryResult>
  exists: (filePath: string) => Promise<boolean>
  platform: NodeJS.Platform
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
