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

export type MenuAction = 'new-project' | 'open-project' | 'save-project' | 'toggle-focus-mode'

export interface SpellCheckContext {
  misspelledWord: string
  suggestions: string[]
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
  onMenuAction: (callback: (action: MenuAction) => void) => void
  removeMenuListeners: () => void
  // Spell check
  addToDictionary: (word: string) => Promise<boolean>
  replaceMisspelling: (word: string) => Promise<boolean>
  onSpellCheckContext: (callback: (data: SpellCheckContext) => void) => void
  removeSpellCheckListener: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
