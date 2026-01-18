import { useEffect } from 'react'
import { useProjectStore } from './stores/projectStore'
import { Layout } from './components/layout/Layout'
import { ToastContainer } from './components/notifications/ToastContainer'

function App() {
  const { loadLastProject } = useProjectStore()

  useEffect(() => {
    loadLastProject()
  }, [loadLastProject])

  return (
    <>
      <Layout />
      <ToastContainer />
    </>
  )
}

export default App
