import { useUIStore } from '@/stores/uiStore'
import { useProjectStore } from '@/stores/projectStore'
import { Sidebar } from './Sidebar'
import { Toolbar } from './Toolbar'
import { EditorArea } from '../editor/EditorArea'
import { WelcomeScreen } from './WelcomeScreen'
import { StatsPanel } from '../stats/StatsPanel'
import { cn } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'

export function Layout() {
  const { sidebarOpen, focusMode, statsSidebarOpen } = useUIStore()
  const { project, isLoading } = useProjectStore()

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    )
  }

  if (!project) {
    return <WelcomeScreen />
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Titlebar drag region for macOS */}
      <div className="h-8 titlebar-drag-region bg-background border-b border-border flex items-center px-20">
        <span className="text-xs text-muted-foreground">{project.meta.name}</span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Manuscript */}
        <div
          className={cn(
            'transition-all duration-200 ease-in-out border-r border-border bg-card',
            sidebarOpen && !focusMode ? 'w-64' : 'w-0',
            focusMode && 'hidden'
          )}
        >
          {sidebarOpen && !focusMode && <Sidebar />}
        </div>

        {/* Editor area with toolbar */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!focusMode && <Toolbar />}
          <EditorArea />
        </div>

        {/* Right Sidebar - Stats */}
        <div
          className={cn(
            'transition-all duration-200 ease-in-out border-l border-border bg-card flex flex-col',
            statsSidebarOpen && !focusMode ? 'w-72' : 'w-0',
            focusMode && 'hidden'
          )}
        >
          {statsSidebarOpen && !focusMode && (
            <>
              {/* Header */}
              <div className="h-10 border-b border-border flex items-center px-4">
                <BarChart3 size={16} className="text-muted-foreground mr-2" />
                <span className="text-sm font-medium">Statistiques</span>
              </div>
              {/* Content */}
              <div className="flex-1 overflow-auto">
                <StatsPanel />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
