import { useEffect, useMemo, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useProjectStore } from '@/stores/projectStore'
import { useEditorStore } from '@/stores/editorStore'
import type { Sheet, CharacterSheet, LocationSheet, PlotSheet, NoteSheet } from '@shared/types/project'
import { Users, MapPin, GitBranch, StickyNote, ArrowLeft } from 'lucide-react'
import { LocationSheetEditor } from './LocationSheetEditor'

/**
 * SheetEditor - Editor for character, location, plot, and note sheets
 */
export function SheetEditor() {
  const { project, activeSheetId, updateSheet, setActiveSheet } = useProjectStore()
  const { currentTemplate } = useEditorStore()

  // Find the active sheet
  const activeSheet = useMemo(() => {
    if (!project || !activeSheetId) return null

    const allSheets: Sheet[] = [
      ...project.sheets.characters,
      ...project.sheets.locations,
      ...project.sheets.plots,
      ...project.sheets.notes
    ]

    return allSheets.find(s => s.id === activeSheetId) || null
  }, [project, activeSheetId])

  // Get sheet content based on type
  const getSheetContent = useCallback((sheet: Sheet): string => {
    switch (sheet.type) {
      case 'character': {
        const cs = sheet as CharacterSheet
        return cs.description || ''
      }
      case 'location': {
        const ls = sheet as LocationSheet
        return ls.description || ''
      }
      case 'plot': {
        const ps = sheet as PlotSheet
        return ps.description || ''
      }
      case 'note': {
        const ns = sheet as NoteSheet
        return ns.content || ''
      }
      default:
        return ''
    }
  }, [])

  // Update sheet content based on type
  const updateSheetContent = useCallback((sheet: Sheet, content: string) => {
    switch (sheet.type) {
      case 'character':
        updateSheet(sheet.id, { description: content, updatedAt: new Date().toISOString() })
        break
      case 'location':
        updateSheet(sheet.id, { description: content, updatedAt: new Date().toISOString() })
        break
      case 'plot':
        updateSheet(sheet.id, { description: content, updatedAt: new Date().toISOString() })
        break
      case 'note':
        updateSheet(sheet.id, { content: content, updatedAt: new Date().toISOString() })
        break
    }
  }, [updateSheet])

  // Create a simple editor for sheet content
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Placeholder.configure({
        placeholder: 'Commencez à écrire...'
      })
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'sheet-editor prose prose-sm max-w-none focus:outline-none'
      }
    },
    onUpdate: ({ editor }) => {
      if (activeSheet) {
        updateSheetContent(activeSheet, editor.getHTML())
      }
    }
  })

  // Load sheet content when active sheet changes
  useEffect(() => {
    if (!editor || !activeSheet) return

    const content = getSheetContent(activeSheet)
    // Only update if content is different to avoid cursor jumps
    if (editor.getHTML() !== content) {
      editor.commands.setContent(content || '')
    }
  }, [editor, activeSheet, getSheetContent])

  // Get icon and label for sheet type
  const sheetInfo = useMemo(() => {
    if (!activeSheet) return { icon: null, label: '' }

    switch (activeSheet.type) {
      case 'character':
        return { icon: <Users size={20} />, label: 'Personnage' }
      case 'location':
        return { icon: <MapPin size={20} />, label: 'Lieu' }
      case 'plot':
        return { icon: <GitBranch size={20} />, label: 'Intrigue' }
      case 'note':
        return { icon: <StickyNote size={20} />, label: 'Note' }
      default:
        return { icon: null, label: '' }
    }
  }, [activeSheet])

  if (!activeSheet) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Fiche non trouvée</p>
      </div>
    )
  }

  // Use specialized editor for location sheets
  if (activeSheet.type === 'location') {
    return <LocationSheetEditor sheet={activeSheet as LocationSheet} />
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-muted">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setActiveSheet(null)}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Retour au manuscrit"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-2 text-muted-foreground">
          {sheetInfo.icon}
          <span className="text-sm">{sheetInfo.label}</span>
        </div>

        <input
          type="text"
          value={activeSheet.name}
          onChange={(e) => updateSheet(activeSheet.id, { name: e.target.value, updatedAt: new Date().toISOString() })}
          className="flex-1 text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0"
          placeholder="Nom de la fiche..."
        />
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-auto p-8">
        <div
          className="max-w-3xl mx-auto bg-paper rounded-lg shadow-md p-8 min-h-[500px]"
          style={{
            fontFamily: currentTemplate.typography.fontFamily,
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
