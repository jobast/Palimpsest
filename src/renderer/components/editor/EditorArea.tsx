import { useEffect, useCallback } from 'react'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Typography from '@tiptap/extension-typography'
import Highlight from '@tiptap/extension-highlight'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import { useStatsStore } from '@/stores/statsStore'
import { usePagination } from '@/hooks/usePagination'
import { useWritingTimer } from '@/hooks/useWritingTimer'
import { DialogueDash, WordStats, SceneBreak, ChapterTitle, FirstParagraph, PageBreakDecorations } from './extensions'
import type { WordStatsData } from './extensions'
import { PagedEditor } from './PagedEditor'
import { SheetEditor } from './SheetEditor'

/**
 * Editor Area - Main container for the paginated editor
 */
export function EditorArea() {
  const { activeDocumentId, activeSheetId, project } = useProjectStore()
  const {
    setEditor,
    getDocumentContent,
    setDocumentContent,
    startSession: startEditorSession,
    updateWordCount
  } = useEditorStore()

  const { recordActivity } = useStatsStore()

  // Initialize pagination system
  usePagination()

  // Initialize writing timer
  useWritingTimer()

  // Word stats callback
  const handleWordStatsUpdate = useCallback((stats: WordStatsData) => {
    updateWordCount(
      stats.totalWords,
      stats.wordsAddedSinceLastUpdate,
      stats.wordsDeletedSinceLastUpdate
    )

    if (stats.wordsAddedSinceLastUpdate > 0 || stats.wordsDeletedSinceLastUpdate > 0) {
      recordActivity(
        stats.totalWords,
        stats.wordsAddedSinceLastUpdate,
        stats.wordsDeletedSinceLastUpdate
      )
    }
  }, [updateWordCount, recordActivity])

  // Create the TipTap editor instance
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph', 'chapterTitle', 'firstParagraph']
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'chapterTitle') {
            return 'Titre du chapitre...'
          }
          return 'Commencez à écrire...'
        }
      }),
      CharacterCount,
      Typography.configure({
        openDoubleQuote: '\u00AB\u00A0',
        closeDoubleQuote: '\u00A0\u00BB',
        openSingleQuote: '\u2018',
        closeSingleQuote: '\u2019'
      }),
      Highlight.configure({ multicolor: true }),
      DialogueDash,
      WordStats.configure({ onUpdate: handleWordStatsUpdate }),
      SceneBreak,
      ChapterTitle,
      FirstParagraph,
      PageBreakDecorations
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'manuscript-editor'
      }
    },
    onUpdate: ({ editor }) => {
      if (activeDocumentId) {
        setDocumentContent(activeDocumentId, JSON.stringify(editor.getJSON()))
      }
    }
  })

  // Register editor in store
  useEffect(() => {
    setEditor(editor)
    return () => setEditor(null)
  }, [editor, setEditor])

  // Load document content when active document changes
  useEffect(() => {
    if (!editor || !activeDocumentId) return

    const savedContent = getDocumentContent(activeDocumentId)
    if (savedContent) {
      try {
        editor.commands.setContent(JSON.parse(savedContent))
      } catch {
        editor.commands.setContent('')
      }
    } else {
      editor.commands.setContent('')
    }

    editor.commands.resetStats()
    const wordCount = editor.storage.characterCount?.words() ?? 0
    startEditorSession(wordCount)
  }, [editor, activeDocumentId, getDocumentContent, startEditorSession])

  if (!project) {
    return null
  }

  // Show sheet editor if a sheet is active
  if (activeSheetId) {
    return <SheetEditor />
  }

  if (!activeDocumentId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Sélectionnez un chapitre pour commencer à écrire</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <PagedEditor />
    </div>
  )
}
