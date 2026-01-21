import { useEffect, useCallback, useRef } from 'react'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Typography from '@tiptap/extension-typography'
import Highlight from '@tiptap/extension-highlight'
import { PaginationPlus } from 'tiptap-pagination-plus'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import { useStatsStore } from '@/stores/statsStore'
import { useAnalysisStore } from '@/stores/analysisStore'
import { useWritingTimer } from '@/hooks/useWritingTimer'
import { DialogueDash, WordStats, SceneBreak, ChapterTitle, FirstParagraph, TextAnalysisDecorations } from './extensions'
import type { WordStatsData } from './extensions'
import { templateToPaginationOptions } from '@/lib/pagination/paginationPlusAdapter'
import { PagedEditor } from './PagedEditor'
import { SheetEditor } from './SheetEditor'
import type { ManuscriptItem } from '@shared/types/project'

// Helper to find a manuscript item by ID (recursive)
function findManuscriptItem(items: ManuscriptItem[], id: string): ManuscriptItem | null {
  for (const item of items) {
    if (item.id === id) return item
    if (item.children) {
      const found = findManuscriptItem(item.children, id)
      if (found) return found
    }
  }
  return null
}

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
  const { currentTemplate } = useEditorStore()

  // Initialize writing timer
  useWritingTimer()

  // Get pagination options from current template
  const paginationOptions = templateToPaginationOptions(currentTemplate)

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
      PaginationPlus.configure(paginationOptions),
      TextAnalysisDecorations
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'manuscript-editor',
        spellcheck: 'true'
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
    if (!editor || !activeDocumentId || !project) return

    const savedContent = getDocumentContent(activeDocumentId)
    if (savedContent) {
      try {
        editor.commands.setContent(JSON.parse(savedContent))
      } catch {
        editor.commands.setContent('')
      }
    } else {
      // Initialize new documents with a chapter title
      const item = findManuscriptItem(project.manuscript.items, activeDocumentId)
      if (item && (item.type === 'chapter' || item.type === 'scene')) {
        // Create initial content with chapter title and empty first paragraph
        editor.commands.setContent({
          type: 'doc',
          content: [
            {
              type: 'chapterTitle',
              content: [{ type: 'text', text: item.title }]
            },
            {
              type: 'firstParagraph',
              content: []
            }
          ]
        })
      } else {
        editor.commands.setContent('')
      }
    }

    editor.commands.resetStats()
    const wordCount = editor.storage.characterCount?.words() ?? 0
    startEditorSession(wordCount)
  }, [editor, activeDocumentId, project, getDocumentContent, startEditorSession])

  // Update pagination settings when template changes
  useEffect(() => {
    if (!editor) return

    const options = templateToPaginationOptions(currentTemplate)

    // Use PaginationPlus commands to update settings
    editor.chain()
      .updatePageHeight(options.pageHeight!)
      .updatePageWidth(options.pageWidth!)
      .updatePageGap(options.pageGap!)
      .updateMargins({
        top: options.marginTop!,
        bottom: options.marginBottom!,
        left: options.marginLeft!,
        right: options.marginRight!
      })
      .updateContentMargins({
        top: options.contentMarginTop!,
        bottom: options.contentMarginBottom!
      })
      .updateHeaderContent(options.headerLeft || '', options.headerRight || '')
      .updateFooterContent(options.footerLeft || '', options.footerRight || '')
      .run()
  }, [editor, currentTemplate])

  // Subscribe to analysis store changes to refresh decorations
  const analysisUpdateCounter = useRef(0)
  const prevAnalysisState = useRef<string | null>(null)
  const { result: analysisResult, activeMode, selectedIssueId } = useAnalysisStore()

  useEffect(() => {
    if (!editor) return

    // Only dispatch if analysis state actually changed (not on initial mount/hydration)
    const stateKey = `${activeMode}-${selectedIssueId}-${analysisResult?.issues.length ?? 0}`
    if (prevAnalysisState.current === null) {
      prevAnalysisState.current = stateKey
      return // Skip initial render
    }

    if (prevAnalysisState.current === stateKey) {
      return // No meaningful change
    }
    prevAnalysisState.current = stateKey

    // Force decoration refresh by dispatching an empty transaction
    analysisUpdateCounter.current++
    const tr = editor.state.tr.setMeta('analysisUpdate', analysisUpdateCounter.current)
    editor.view.dispatch(tr)
  }, [editor, analysisResult, activeMode, selectedIssueId])

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
