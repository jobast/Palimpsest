import { useEffect, useState, useCallback, useRef } from 'react'
import { useProjectStore } from './stores/projectStore'
import { useUIStore } from './stores/uiStore'
import { useStatsStore } from './stores/statsStore'
import { useExport } from './hooks/useExport'
import { Layout } from './components/layout/Layout'
import { ToastContainer } from './components/notifications/ToastContainer'
import { NewProjectForm } from './components/layout/WelcomeScreen'
import { SettingsModal } from './components/ui/SettingsModal'

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined

function App() {
  const openProject = useProjectStore(state => state.openProject)
  const saveProject = useProjectStore(state => state.saveProject)
  const isDirty = useProjectStore(state => state.isDirty)
  const statsDirty = useStatsStore(state => state.statsDirty)
  const project = useProjectStore(state => state.project)
  const toggleFocusMode = useUIStore(state => state.toggleFocusMode)
  const autoSaveEnabled = useUIStore(state => state.autoSaveEnabled)
  const autoSaveInterval = useUIStore(state => state.autoSaveInterval)
  const theme = useUIStore(state => state.theme)
  const setTheme = useUIStore(state => state.setTheme)
  const paperColor = useUIStore(state => state.paperColor)
  const setPaperColor = useUIStore(state => state.setPaperColor)
  const { exportDocx, exportPdf } = useExport()
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false)
  const autoSaveTimerRef = useRef<number | null>(null)

  // Refs for menu action handlers to avoid re-registering listeners
  const menuHandlersRef = useRef({
    openProject,
    saveProject,
    toggleFocusMode,
    exportDocx,
    exportPdf,
    setShowNewProjectDialog
  })
  // Keep refs updated
  menuHandlersRef.current = {
    openProject,
    saveProject,
    toggleFocusMode,
    exportDocx,
    exportPdf,
    setShowNewProjectDialog
  }

  // Don't auto-load last project - let WelcomeScreen show recent projects instead

  // Apply theme and paper color on initial load
  useEffect(() => {
    setTheme(theme)
    setPaperColor(paperColor)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save logic
  useEffect(() => {
    // Clear any existing timer
    if (autoSaveTimerRef.current) {
      window.clearInterval(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }

    // Only set up auto-save if enabled and we have a project
    if (!autoSaveEnabled || !project) {
      return
    }

    autoSaveTimerRef.current = window.setInterval(() => {
      if (isDirty || statsDirty) {
        saveProject()
      }
    }, autoSaveInterval * 1000)

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearInterval(autoSaveTimerRef.current)
      }
    }
  }, [autoSaveEnabled, autoSaveInterval, project, isDirty, statsDirty, saveProject])

  // Menu action handler - uses refs to avoid re-registering listeners
  const handleMenuAction = useCallback((action: string) => {
    const handlers = menuHandlersRef.current
    switch (action) {
      case 'new-project':
        handlers.setShowNewProjectDialog(true)
        break
      case 'open-project':
        handlers.openProject()
        break
      case 'save-project':
        handlers.saveProject()
        break
      case 'toggle-focus-mode':
        handlers.toggleFocusMode()
        break
      case 'export-docx':
        handlers.exportDocx()
        break
      case 'export-pdf':
        handlers.exportPdf()
        break
    }
  }, []) // Empty deps - handlers accessed via ref

  // Listen for menu actions from Electron
  useEffect(() => {
    if (!isElectron) {
      return
    }

    window.electronAPI.onMenuAction(handleMenuAction)

    return () => {
      window.electronAPI.removeMenuListeners()
    }
  }, [handleMenuAction])

  return (
    <>
      <Layout />
      <ToastContainer />
      <SettingsModal />
      {showNewProjectDialog && (
        <NewProjectForm
          onCancel={() => setShowNewProjectDialog(false)}
          isModal={true}
        />
      )}
    </>
  )
}

export default App
