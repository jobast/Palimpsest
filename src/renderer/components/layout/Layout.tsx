import { useState } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useProjectStore } from '@/stores/projectStore'
import { Sidebar } from './Sidebar'
import { Toolbar } from './Toolbar'
import { EditorArea } from '../editor/EditorArea'
import { WelcomeScreen } from './WelcomeScreen'
import { StatsPanel } from '../stats/StatsPanel'
import { FormattingPanel } from '../editor/FormattingPanel'
import { AnalysisPanel } from '../analysis/AnalysisPanel'
import { AIPanel } from '../ai/AIPanel'
import { cn } from '@/lib/utils'
import { BarChart3, Type, Search, Bot, X } from 'lucide-react'

type RightSidebarTab = 'stats' | 'format' | 'analysis' | 'ai'

export function Layout() {
  const { sidebarOpen, focusMode, statsSidebarOpen, toggleFocusMode } = useUIStore()
  const { project, isLoading } = useProjectStore()
  const [rightSidebarTab, setRightSidebarTab] = useState<RightSidebarTab>('stats')

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
      {/* Titlebar drag region for macOS - hidden in focus mode */}
      {!focusMode && (
        <div className="h-8 titlebar-drag-region bg-background border-b border-border flex items-center px-20">
          <span className="text-xs text-muted-foreground">{project.meta.name}</span>
        </div>
      )}

      {/* Focus mode exit button */}
      {focusMode && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <div className="text-xs text-muted-foreground bg-card/80 backdrop-blur px-3 py-1.5 rounded-full border border-border shadow-sm opacity-50 hover:opacity-100 transition-opacity">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">⌘⇧F</kbd>
          </div>
          <button
            onClick={toggleFocusMode}
            className="p-2 bg-card/80 backdrop-blur rounded-full border border-border shadow-sm text-muted-foreground hover:text-foreground hover:bg-card transition-all opacity-50 hover:opacity-100"
            title="Quitter le mode focus"
          >
            <X size={16} />
          </button>
        </div>
      )}

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

        {/* Right Sidebar - Stats & Formatting */}
        <div
          className={cn(
            'transition-all duration-200 ease-in-out border-l border-border bg-card flex flex-col',
            statsSidebarOpen && !focusMode ? 'w-72' : 'w-0',
            focusMode && 'hidden'
          )}
        >
          {statsSidebarOpen && !focusMode && (
            <>
              {/* Tab Header */}
              <div className="h-10 border-b border-border flex items-center">
                <button
                  onClick={() => setRightSidebarTab('stats')}
                  className={cn(
                    'flex-1 h-full flex items-center justify-center transition-colors',
                    rightSidebarTab === 'stats'
                      ? 'text-foreground border-b-2 border-primary bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Statistiques"
                >
                  <BarChart3 size={16} />
                </button>
                <button
                  onClick={() => setRightSidebarTab('format')}
                  className={cn(
                    'flex-1 h-full flex items-center justify-center transition-colors',
                    rightSidebarTab === 'format'
                      ? 'text-foreground border-b-2 border-primary bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Format"
                >
                  <Type size={16} />
                </button>
                <button
                  onClick={() => setRightSidebarTab('analysis')}
                  className={cn(
                    'flex-1 h-full flex items-center justify-center transition-colors',
                    rightSidebarTab === 'analysis'
                      ? 'text-foreground border-b-2 border-primary bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Analyse"
                >
                  <Search size={16} />
                </button>
                <button
                  onClick={() => setRightSidebarTab('ai')}
                  className={cn(
                    'flex-1 h-full flex items-center justify-center transition-colors',
                    rightSidebarTab === 'ai'
                      ? 'text-foreground border-b-2 border-primary bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Assistant IA"
                >
                  <Bot size={16} />
                </button>
              </div>
              {/* Content */}
              <div className="flex-1 overflow-auto">
                {rightSidebarTab === 'stats' && <StatsPanel />}
                {rightSidebarTab === 'format' && <FormattingPanel />}
                {rightSidebarTab === 'analysis' && <AnalysisPanel />}
                {rightSidebarTab === 'ai' && <AIPanel />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
