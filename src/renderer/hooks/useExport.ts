import { useCallback, useState } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import {
  exportToDocx,
  downloadDocx,
  exportToPdf,
  downloadPdf
} from '@/lib/export'

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
   * Export to PDF format
   * Requires page elements from PageView component
   */
  const exportPdf = useCallback(async (pageElements?: HTMLElement[]) => {
    if (!project) {
      setState(s => ({ ...s, error: 'Projet non disponible' }))
      return
    }

    // If no page elements provided, try to find them in DOM
    const pages = pageElements || Array.from(
      document.querySelectorAll('.page-container')
    ) as HTMLElement[]

    if (pages.length === 0) {
      setState(s => ({
        ...s,
        error: 'Aucune page à exporter. Passez en mode Pages d\'abord.'
      }))
      return
    }

    setState({
      isExporting: true,
      progress: 0,
      format: 'pdf',
      error: null
    })

    try {
      const blob = await exportToPdf({
        pages,
        template: currentTemplate,
        project,
        quality: 'standard',
        onProgress: (current, total) => {
          setState(s => ({
            ...s,
            progress: Math.round((current / total) * 90)
          }))
        }
      })

      setState(s => ({ ...s, progress: 95 }))

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
