import { create } from 'zustand'
import type { Editor } from '@tiptap/react'
import type { PageTemplate } from '@shared/types/templates'
import { defaultTemplates } from '@shared/types/templates'
import type { UserTypographyOverrides } from '@shared/types/project'

// Re-export for convenience
export type { UserTypographyOverrides }

// Effective typography combining template + user overrides
export interface EffectiveTypography {
  fontFamily: string
  fontSize: string
  lineHeight: number
  paragraphSpacing: string
  firstLineIndent: string
}

interface EditorState {
  editor: Editor | null
  currentTemplate: PageTemplate
  userTypographyOverrides: UserTypographyOverrides
  documentContents: Map<string, string>

  // Word stats for current session
  sessionStartWords: number
  currentWords: number
  wordsAdded: number
  wordsDeleted: number
  sessionStartTime: Date | null

  // Actions
  setEditor: (editor: Editor | null) => void
  setTemplate: (templateId: string) => void

  // Typography overrides
  setUserTypographyOverride: <K extends keyof UserTypographyOverrides>(key: K, value: UserTypographyOverrides[K] | null) => void
  resetUserOverrides: () => void
  loadUserOverrides: (overrides: UserTypographyOverrides) => void
  getEffectiveTypography: () => EffectiveTypography

  // Document content
  getDocumentContent: (documentId: string) => string | undefined
  setDocumentContent: (documentId: string, content: string) => void
  getAllDocumentContents: () => Map<string, string>
  loadDocumentContents: (contents: Record<string, string>) => void
  clearDocumentContents: () => void
  flushCurrentDocument: (activeDocumentId: string | null) => void  // Force save current editor content to store

  // Word tracking
  startSession: (initialWords: number) => void
  updateWordCount: (currentCount: number, addedSinceLastUpdate: number, deletedSinceLastUpdate: number) => void
  endSession: () => { wordsAdded: number; wordsDeleted: number; netWords: number; durationMinutes: number } | null
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editor: null,
  currentTemplate: defaultTemplates[0],
  userTypographyOverrides: {},
  documentContents: new Map(),

  sessionStartWords: 0,
  currentWords: 0,
  wordsAdded: 0,
  wordsDeleted: 0,
  sessionStartTime: null,

  setEditor: (editor) => set({ editor }),

  setTemplate: (templateId) => {
    const template = defaultTemplates.find(t => t.id === templateId)
    if (template) {
      // Reset user overrides when changing template
      set({ currentTemplate: template, userTypographyOverrides: {} })
    }
  },

  setUserTypographyOverride: (key, value) => {
    const { userTypographyOverrides } = get()
    const newOverrides = { ...userTypographyOverrides }
    if (value === null || value === undefined) {
      delete newOverrides[key]
    } else {
      newOverrides[key] = value
    }
    set({ userTypographyOverrides: newOverrides })
  },

  resetUserOverrides: () => {
    set({ userTypographyOverrides: {} })
  },

  loadUserOverrides: (overrides) => {
    set({ userTypographyOverrides: overrides || {} })
  },

  getEffectiveTypography: () => {
    const { currentTemplate, userTypographyOverrides } = get()
    return {
      fontFamily: currentTemplate.typography.fontFamily,
      fontSize: userTypographyOverrides.fontSize ?? currentTemplate.typography.fontSize,
      lineHeight: userTypographyOverrides.lineHeight ?? currentTemplate.typography.lineHeight,
      paragraphSpacing: currentTemplate.typography.paragraphSpacing,
      firstLineIndent: userTypographyOverrides.firstLineIndent ?? currentTemplate.typography.firstLineIndent,
    }
  },

  getDocumentContent: (documentId) => {
    return get().documentContents.get(documentId)
  },

  setDocumentContent: (documentId, content) => {
    const { documentContents } = get()
    const newContents = new Map(documentContents)
    newContents.set(documentId, content)
    set({ documentContents: newContents })
  },

  getAllDocumentContents: () => {
    return get().documentContents
  },

  loadDocumentContents: (contents) => {
    const newContents = new Map<string, string>()
    for (const [id, content] of Object.entries(contents)) {
      newContents.set(id, content)
    }
    set({ documentContents: newContents })
  },

  clearDocumentContents: () => {
    set({ documentContents: new Map() })
  },

  flushCurrentDocument: (activeDocumentId) => {
    const { editor, documentContents } = get()
    if (!editor || !activeDocumentId) return

    // Save current editor content to store immediately
    const content = JSON.stringify(editor.getJSON())
    const newContents = new Map(documentContents)
    newContents.set(activeDocumentId, content)
    set({ documentContents: newContents })
  },

  startSession: (initialWords) => {
    set({
      sessionStartWords: initialWords,
      currentWords: initialWords,
      wordsAdded: 0,
      wordsDeleted: 0,
      sessionStartTime: new Date()
    })
  },

  updateWordCount: (currentCount, addedSinceLastUpdate, deletedSinceLastUpdate) => {
    const { wordsAdded, wordsDeleted } = get()
    set({
      currentWords: currentCount,
      wordsAdded: wordsAdded + addedSinceLastUpdate,
      wordsDeleted: wordsDeleted + deletedSinceLastUpdate
    })
  },

  endSession: () => {
    const { sessionStartTime, wordsAdded, wordsDeleted } = get()
    if (!sessionStartTime) return null

    const durationMinutes = Math.round((Date.now() - sessionStartTime.getTime()) / 60000)
    const result = {
      wordsAdded,
      wordsDeleted,
      netWords: wordsAdded - wordsDeleted,
      durationMinutes
    }

    set({
      sessionStartWords: 0,
      currentWords: 0,
      wordsAdded: 0,
      wordsDeleted: 0,
      sessionStartTime: null
    })

    return result
  }
}))
