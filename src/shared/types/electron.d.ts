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

export type MenuAction =
  | 'new-project'
  | 'open-project'
  | 'save-project'
  | 'toggle-focus-mode'
  | 'export-docx'
  | 'export-pdf'

export interface SpellCheckContext {
  misspelledWord: string
  suggestions: string[]
}

export interface PrintToPDFOptions {
  pageWidth: number // in microns
  pageHeight: number // in microns
  margins: { top: number; bottom: number; left: number; right: number } // in microns
}

export interface PrintToPDFResult {
  success: boolean
  data?: Buffer
  error?: string
}

export interface SavePDFResult {
  success: boolean
  filePath?: string
  error?: string
}

export interface AIKeyStatus {
  encryptionAvailable: boolean
  hasClaudeKey: boolean
  hasOpenaiKey: boolean
  claudeKeyHint: string | null
  openaiKeyHint: string | null
}

export interface AIChatRequest {
  provider: 'claude' | 'openai' | 'ollama'
  model: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  ollamaConfig?: { endpoint: string; model: string }
}

export interface AIChatResponse {
  content: string
  tokensUsed: { input: number; output: number }
  model: string
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
  // PDF Export
  printToPDF: (options: PrintToPDFOptions) => Promise<PrintToPDFResult>
  savePDF: (data: Buffer, defaultFilename: string) => Promise<SavePDFResult>
  // AI
  aiGetKeyStatus: () => Promise<AIKeyStatus>
  aiSetApiKey: (provider: 'claude' | 'openai', key: string) => Promise<{ success: boolean }>
  aiClearApiKey: (provider: 'claude' | 'openai') => Promise<{ success: boolean }>
  aiChat: (request: AIChatRequest) => Promise<AIChatResponse>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
