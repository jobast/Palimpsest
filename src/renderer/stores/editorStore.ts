import { create } from 'zustand'
import type { Editor } from '@tiptap/react'
import type { PageTemplate } from '@shared/types/templates'
import { defaultTemplates } from '@shared/types/templates'

export type ViewMode = 'text' | 'page'

interface EditorState {
  editor: Editor | null
  currentTemplate: PageTemplate
  documentContents: Map<string, string>
  viewMode: ViewMode

  // Word stats for current session
  sessionStartWords: number
  currentWords: number
  wordsAdded: number
  wordsDeleted: number
  sessionStartTime: Date | null

  // Actions
  setEditor: (editor: Editor | null) => void
  setTemplate: (templateId: string) => void
  setViewMode: (mode: ViewMode) => void

  // Document content
  getDocumentContent: (documentId: string) => string | undefined
  setDocumentContent: (documentId: string, content: string) => void

  // Word tracking
  startSession: (initialWords: number) => void
  updateWordCount: (currentCount: number, addedSinceLastUpdate: number, deletedSinceLastUpdate: number) => void
  endSession: () => { wordsAdded: number; wordsDeleted: number; netWords: number; durationMinutes: number } | null
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editor: null,
  currentTemplate: defaultTemplates[0],
  documentContents: new Map(),
  viewMode: 'text' as ViewMode,

  sessionStartWords: 0,
  currentWords: 0,
  wordsAdded: 0,
  wordsDeleted: 0,
  sessionStartTime: null,

  setEditor: (editor) => set({ editor }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setTemplate: (templateId) => {
    const template = defaultTemplates.find(t => t.id === templateId)
    if (template) {
      set({ currentTemplate: template })
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
