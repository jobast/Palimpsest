import { useCallback, useState } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import { useUIStore } from '@/stores/uiStore'
import {
  exportToDocx,
  downloadDocx
} from '@/lib/export'
import { exportToPdf, downloadPdf } from '@/lib/export/pdfExporter'

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
   * Export to DOCX format
   */
  const exportDocx = useCallback(async () => {
    if (!editor || !project) {
      setState(s => ({ ...s, error: 'Éditeur ou projet non disponible' }))
      return
    }

    setState({
      isExporting: true,
      progress: 0,
      format: 'docx',
      error: null
    })

    try {
      setState(s => ({ ...s, progress: 30 }))

      const blob = await exportToDocx({
        editor,
        template: currentTemplate,
        project,
        includeHeaders: true,
        includeFooters: true
      })

      setState(s => ({ ...s, progress: 80 }))

      await downloadDocx(blob, `${project.meta.name}.docx`)

      setState(s => ({ ...s, progress: 100 }))

      // Reset after short delay
      setTimeout(() => {
        setState({
          isExporting: false,
          progress: 0,
          format: null,
          error: null
        })
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
   * Export to PDF format using html2canvas + jsPDF
   * Captures all pages by temporarily disabling virtualization
   */
  const exportPdf = useCallback(async () => {
    if (!project) {
      setState(s => ({ ...s, error: 'Projet non disponible' }))
      return
    }

    const { setIsExportingPdf, zoomLevel, setZoomLevel } = useUIStore.getState()
    const originalZoom = zoomLevel

    setState({
      isExporting: true,
      progress: 0,
      format: 'pdf',
      error: null
    })

    try {
      setState(s => ({ ...s, progress: 10 }))

      // 1. Disable virtualization and reset zoom to 100%
      setIsExportingPdf(true)
      if (zoomLevel !== 100) {
        setZoomLevel(100)
      }

      setState(s => ({ ...s, progress: 20 }))

      // 2. Wait for all pages to render (virtualization off, zoom reset)
      await new Promise(resolve => setTimeout(resolve, 500))

      setState(s => ({ ...s, progress: 30 }))

      // 3. Get the editor element
      const editorElement = document.querySelector('.ProseMirror.rm-with-pagination') as HTMLElement

      if (!editorElement) {
        throw new Error('Éditeur non trouvé')
      }

      // Force all elements to be visible (remove any content-visibility)
      editorElement.style.contentVisibility = 'visible'
      const allPageBreaks = editorElement.querySelectorAll('.rm-page-break')
      allPageBreaks.forEach(pageBreak => {
        (pageBreak as HTMLElement).style.contentVisibility = 'visible'
      })

      // Wait for forced visibility to take effect
      await new Promise(resolve => setTimeout(resolve, 300))

      const gapsCount = editorElement.querySelectorAll('.rm-pagination-gap').length
      console.log(`PDF Export: Found editor with ${gapsCount + 1} pages`)

      setState(s => ({ ...s, progress: 40 }))

      // 4. Generate PDF with progress callback
      const blob = await exportToPdf({
        editorElement,
        template: currentTemplate,
        project,
        quality: 'standard',
        onProgress: (current, total) => {
          const progress = 40 + Math.round((current / total) * 50)
          setState(s => ({ ...s, progress }))
        }
      })

      setState(s => ({ ...s, progress: 95 }))

      // 5. Restore virtualization and zoom
      setIsExportingPdf(false)
      if (originalZoom !== 100) {
        setZoomLevel(originalZoom)
      }

      // 6. Download PDF
      await downloadPdf(blob, `${project.meta.name}.pdf`)

      setState(s => ({ ...s, progress: 100 }))

      // Reset after short delay
      setTimeout(() => {
        setState({
          isExporting: false,
          progress: 0,
          format: null,
          error: null
        })
      }, 1000)
    } catch (error) {
      // Restore state on error
      setIsExportingPdf(false)
      if (originalZoom !== 100) {
        setZoomLevel(originalZoom)
      }

      console.error('PDF export failed:', error)
      setState({
        isExporting: false,
        progress: 0,
        format: null,
        error: `Échec de l'export PDF: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      })
    }
  }, [currentTemplate, project])

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
