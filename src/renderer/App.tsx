import { useEffect, useState, useCallback, useRef } from 'react'
import { useProjectStore } from './stores/projectStore'
import { useUIStore } from './stores/uiStore'
import { useExport } from './hooks/useExport'
import { Layout } from './components/layout/Layout'
import { ToastContainer } from './components/notifications/ToastContainer'
import { NewProjectForm } from './components/layout/WelcomeScreen'
import { SettingsModal } from './components/ui/SettingsModal'

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined

function App() {
  const loadLastProject = useProjectStore(state => state.loadLastProject)
  const openProject = useProjectStore(state => state.openProject)
  const saveProject = useProjectStore(state => state.saveProject)
  const isDirty = useProjectStore(state => state.isDirty)
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

  useEffect(() => {
    loadLastProject()
  }, [loadLastProject])

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
      if (isDirty) {
        console.log('Auto-saving project...')
        saveProject()
      }
    }, autoSaveInterval * 1000)

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearInterval(autoSaveTimerRef.current)
      }
    }
  }, [autoSaveEnabled, autoSaveInterval, project, isDirty, saveProject])

  // Menu action handler
  const handleMenuAction = useCallback((action: string) => {
    console.log('Menu action received:', action)
    switch (action) {
      case 'new-project':
        setShowNewProjectDialog(true)
        break
      case 'open-project':
        openProject()
        break
      case 'save-project':
        saveProject()
        break
      case 'toggle-focus-mode':
        toggleFocusMode()
        break
      case 'export-docx':
        exportDocx()
        break
      case 'export-pdf':
        exportPdf()
        break
    }
  }, [openProject, saveProject, toggleFocusMode, exportDocx, exportPdf])

  // Listen for menu actions from Electron
  useEffect(() => {
    if (!isElectron) {
      console.log('Not running in Electron')
      return
    }

    console.log('Setting up menu listeners')
    window.electronAPI.onMenuAction(handleMenuAction)

    return () => {
      console.log('Removing menu listeners')
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
