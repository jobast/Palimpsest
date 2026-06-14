import { useCallback, useState } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import {
  exportToDocx,
  downloadDocx
} from '@/lib/export'
import { downloadPdf } from '@/lib/export/pdfExporter'
import { flattenChapterIds } from '@shared/manuscript/order'
import { docToPrintHtml, buildBookHtml, buildPrintHeaderFooter } from '@shared/export/printHtml'
import type { TipTapDoc } from '@shared/markdown'

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
   * Export to PDF format - vector PDF rendered in the main process via Chromium printToPDF
   */
  const exportPdf = useCallback(async () => {
    if (!editor || !project) {
      setState(s => ({ ...s, error: 'Éditeur ou projet non disponible' }))
      return
    }
    setState({ isExporting: true, progress: 0, format: 'pdf', error: null })
    try {
      // Flush the active chapter so its latest edits are in documentContents.
      useEditorStore.getState().flushCurrentDocument(useProjectStore.getState().activeDocumentId)
      const { documentContents } = useEditorStore.getState()
      const chapterHtmls = flattenChapterIds(project.manuscript.items)
        .map(id => documentContents.get(id))
        .filter((c): c is string => !!c)
        .map(json => docToPrintHtml(JSON.parse(json) as TipTapDoc))

      if (chapterHtmls.length === 0) {
        setState({ isExporting: false, progress: 0, format: null, error: 'Rien à exporter' })
        return
      }

      setState(s => ({ ...s, progress: 30 }))
      const html = buildBookHtml(chapterHtmls, currentTemplate, project)
      const { displayHeaderFooter, headerTemplate, footerTemplate } =
        buildPrintHeaderFooter(currentTemplate, project)

      setState(s => ({ ...s, progress: 50 }))
      const result = await window.electronAPI.printBookPdf({
        html, displayHeaderFooter, headerTemplate, footerTemplate
      })
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Échec du rendu PDF')
      }

      setState(s => ({ ...s, progress: 85 }))
      const blob = new Blob([result.data as BlobPart], { type: 'application/pdf' })
      await downloadPdf(blob, `${project.meta.name}.pdf`)
      setState(s => ({ ...s, progress: 100 }))
      setTimeout(() => {
        setState({ isExporting: false, progress: 0, format: null, error: null })
      }, 1000)
    } catch (error) {
      console.error('PDF export failed:', error)
      setState({
        isExporting: false, progress: 0, format: null,
        error: `Échec de l'export PDF: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      })
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
