import { useEffect, useState, useCallback } from 'react'
import { useProjectStore } from './stores/projectStore'
import { useUIStore } from './stores/uiStore'
import { Layout } from './components/layout/Layout'
import { ToastContainer } from './components/notifications/ToastContainer'
import { NewProjectForm } from './components/layout/WelcomeScreen'

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined

function App() {
  const loadLastProject = useProjectStore(state => state.loadLastProject)
  const openProject = useProjectStore(state => state.openProject)
  const saveProject = useProjectStore(state => state.saveProject)
  const toggleFocusMode = useUIStore(state => state.toggleFocusMode)
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false)

  useEffect(() => {
    loadLastProject()
  }, [loadLastProject])

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
    }
  }, [openProject, saveProject, toggleFocusMode])

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
