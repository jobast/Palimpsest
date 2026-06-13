import { useCallback, useState } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import { useUIStore } from '@/stores/uiStore'
import {
  exportToDocx,
  downloadDocx
} from '@/lib/export'
import { capturePageImages, assembleBookPdf, downloadPdf } from '@/lib/export/pdfExporter'
import { flattenChapterIds } from '@shared/manuscript/order'

export interface ExportState {
  isExporting: boolean
  progress: number
  format: 'docx' | 'pdf' | null
  error: string | null
}

/**
 * Hook for exporting documents to DOCX and PDF formats
 */
export function useExport() {
  const { editor, currentTemplate } = useEditorStore()
  const { project } = useProjectStore()

  const [state, setState] = useState<ExportState>({
    isExporting: false,
    progress: 0,
    format: null,
    error: null
  })

  /**
   * Export to DOCX format - exports all chapters in manuscript order
   */
  const exportDocx = useCallback(async () => {
    if (!editor || !project) {
      setState(s => ({ ...s, error: 'Éditeur ou projet non disponible' }))
      return
    }
    setState({ isExporting: true, progress: 0, format: 'docx', error: null })
    try {
      // Flush the active chapter so its latest edits are in documentContents.
      useEditorStore.getState().flushCurrentDocument(useProjectStore.getState().activeDocumentId)
      const { documentContents } = useEditorStore.getState()
      const chapterDocs = flattenChapterIds(project.manuscript.items)
        .map(id => documentContents.get(id))
        .filter((c): c is string => !!c)
        .map(json => editor.schema.nodeFromJSON(JSON.parse(json)))

      if (chapterDocs.length === 0) {
        setState({ isExporting: false, progress: 0, format: null, error: 'Rien à exporter' })
        return
      }

      setState(s => ({ ...s, progress: 40 }))
      const blob = await exportToDocx({
        chapterDocs,
        template: currentTemplate,
        project,
        includeHeaders: true,
        includeFooters: true
      })
      setState(s => ({ ...s, progress: 80 }))
      await downloadDocx(blob, `${project.meta.name}.docx`)
      setState(s => ({ ...s, progress: 100 }))
      setTimeout(() => {
        setState({ isExporting: false, progress: 0, format: null, error: null })
      }, 1000)
    } catch (error) {
      console.error('DOCX export failed:', error)
      setState({
        isExporting: false,
        progress: 0,
        format: null,
        error: `Échec de l'export DOCX: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      })
    }
  }, [editor, currentTemplate, project])

  /**
   * Export to PDF format - captures all chapters in manuscript order
   * Loads each chapter into the editor and captures its pages before assembling.
   */
  const exportPdf = useCallback(async () => {
    if (!editor || !project) {
      setState(s => ({ ...s, error: 'Éditeur ou projet non disponible' }))
      return
    }

    const { setIsExportingPdf, zoomLevel, setZoomLevel } = useUIStore.getState()
    const originalZoom = zoomLevel
    const originalDocId = useProjectStore.getState().activeDocumentId
    const originalNoteId = useProjectStore.getState().activeNoteId
    const originalSheetId = useProjectStore.getState().activeSheetId
    const originalReportId = useProjectStore.getState().activeReportId

    setState({ isExporting: true, progress: 0, format: 'pdf', error: null })

    try {
      setIsExportingPdf(true)
      if (zoomLevel !== 100) setZoomLevel(100)

      // Flush the active chapter, then collect chapters that have content.
      useEditorStore.getState().flushCurrentDocument(originalDocId)
      const { documentContents } = useEditorStore.getState()
      const ids = flattenChapterIds(project.manuscript.items)
        .filter(id => !!documentContents.get(id))

      if (ids.length === 0) {
        setState({ isExporting: false, progress: 0, format: null, error: 'Rien à exporter' })
        return
      }

      const allPages: string[] = []
      for (let i = 0; i < ids.length; i++) {
        // Load this chapter into the editor and let pagination settle.
        useProjectStore.getState().setActiveDocument(ids[i])
        await new Promise(resolve => setTimeout(resolve, 600))

        let editorElement = document.querySelector('.ProseMirror.rm-with-pagination') as HTMLElement | null
        if (!editorElement) {
          // One retry - the editor may still be mounting.
          await new Promise(resolve => setTimeout(resolve, 600))
          editorElement = document.querySelector('.ProseMirror.rm-with-pagination') as HTMLElement | null
        }
        if (!editorElement) {
          console.warn('Chapitre ignoré (éditeur introuvable):', ids[i])
          continue
        }

        // Force visibility (defeat virtualization) before capture.
        editorElement.style.contentVisibility = 'visible'
        editorElement.querySelectorAll('.rm-page-break').forEach(pb => {
          (pb as HTMLElement).style.contentVisibility = 'visible'
        })
        await new Promise(resolve => setTimeout(resolve, 200))

        const pages = await capturePageImages(editorElement, currentTemplate, 'high')
        allPages.push(...pages)
        setState(s => ({ ...s, progress: Math.round(((i + 1) / ids.length) * 90) }))
      }

      if (allPages.length === 0) {
        throw new Error('Aucune page capturée')
      }

      const blob = assembleBookPdf(allPages, currentTemplate, project)
      setState(s => ({ ...s, progress: 95 }))
      await downloadPdf(blob, `${project.meta.name}.pdf`)
      setState(s => ({ ...s, progress: 100 }))
      setTimeout(() => {
        setState({ isExporting: false, progress: 0, format: null, error: null })
      }, 1000)
    } catch (error) {
      console.error('PDF export failed:', error)
      setState({
        isExporting: false,
        progress: 0,
        format: null,
        error: `Échec de l'export PDF: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      })
    } finally {
      // Restore virtualization, zoom and the original view (whichever it was).
      setIsExportingPdf(false)
      if (originalZoom !== 100) setZoomLevel(originalZoom)
      if (originalNoteId) {
        useProjectStore.getState().setActiveNote(originalNoteId)
      } else if (originalSheetId) {
        useProjectStore.getState().setActiveSheet(originalSheetId)
      } else if (originalReportId) {
        useProjectStore.getState().setActiveReport(originalReportId)
      } else if (originalDocId) {
        useProjectStore.getState().setActiveDocument(originalDocId)
      }
    }
  }, [editor, currentTemplate, project])

  /**
   * Clear any error state
   */
  const clearError = useCallback(() => {
    setState(s => ({ ...s, error: null }))
  }, [])

  return {
    ...state,
    exportDocx,
    exportPdf,
    clearError
  }
}
