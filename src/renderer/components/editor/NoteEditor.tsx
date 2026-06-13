import { useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'

/**
 * NoteEditor - center view for a chapter's private note (.note.md sidecar).
 * Plain textarea with debounced autosave. Never part of the manuscript/export.
 */
export function NoteEditor() {
  const { activeNoteId, project, loadChapterNote, saveChapterNote, setActiveDocument } = useProjectStore()
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const chapter = project && activeNoteId
    ? project.manuscript.items.find(i => i.id === activeNoteId)
    : null

  // Load the note when the active note changes.
  useEffect(() => {
    let cancelled = false
    if (!activeNoteId) return
    setLoading(true)
    loadChapterNote(activeNoteId).then((content) => {
      if (!cancelled) { setValue(content); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [activeNoteId, loadChapterNote])

  // Flush pending save on unmount / note switch.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const handleChange = (next: string) => {
    setValue(next)
    if (!activeNoteId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const id = activeNoteId
    saveTimer.current = setTimeout(() => { void saveChapterNote(id, next) }, 500)
  }

  if (!activeNoteId) return null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <button
          onClick={() => {
            if (saveTimer.current) { clearTimeout(saveTimer.current); void saveChapterNote(activeNoteId, value) }
            setActiveDocument(activeNoteId)
          }}
          className="p-1 rounded hover:bg-accent text-muted-foreground"
          title="Retour au chapitre"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="text-sm font-medium">
          Note — {chapter?.title ?? 'Chapitre'}
        </span>
      </div>
      <textarea
        value={loading ? '' : value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Note privée du chapitre (jamais exportée)…"
        className="flex-1 w-full resize-none bg-background text-foreground p-6 focus:outline-none font-serif leading-relaxed"
        autoFocus
      />
    </div>
  )
}
