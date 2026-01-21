import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SidebarPanel = 'project' | 'sheets' | 'analysis' | 'pages'
type PaperColor = 'white' | 'cream' | 'sepia'

interface UIState {
  sidebarOpen: boolean
  sidebarPanel: SidebarPanel
  statsSidebarOpen: boolean
  rightPanelOpen: boolean
  theme: 'light' | 'dark' | 'system'
  paperColor: PaperColor
  showWordCount: boolean
  focusMode: boolean
  settingsOpen: boolean

  // Auto-save settings
  autoSaveEnabled: boolean
  autoSaveInterval: number // in seconds

  // Zoom settings
  zoomLevel: number // percentage (50-200)

  // Actions
  toggleSidebar: () => void
  setSidebarPanel: (panel: SidebarPanel) => void
  toggleStatsSidebar: () => void
  toggleRightPanel: () => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setPaperColor: (color: PaperColor) => void
  toggleWordCount: () => void
  toggleFocusMode: () => void
  openSettings: () => void
  closeSettings: () => void
  setAutoSaveEnabled: (enabled: boolean) => void
  setAutoSaveInterval: (seconds: number) => void
  setZoomLevel: (level: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
}

// Apply theme to document
const applyTheme = (theme: 'light' | 'dark' | 'system') => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else if (theme === 'light') {
    document.documentElement.classList.remove('dark')
  } else {
    // System preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', prefersDark)
  }
}

// Apply paper color to document
const applyPaperColor = (color: PaperColor) => {
  document.documentElement.classList.remove('paper-white', 'paper-cream', 'paper-sepia')
  document.documentElement.classList.add(`paper-${color}`)
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarPanel: 'project',
      statsSidebarOpen: true,
      rightPanelOpen: false,
      theme: 'light',
      paperColor: 'cream',
      showWordCount: true,
      focusMode: false,
      settingsOpen: false,

      // Auto-save settings (default: enabled, 30 seconds)
      autoSaveEnabled: true,
      autoSaveInterval: 30,

      // Zoom settings (default: 100%)
      zoomLevel: 100,

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarPanel: (panel) => set({ sidebarPanel: panel, sidebarOpen: true }),

      toggleStatsSidebar: () => set((state) => ({ statsSidebarOpen: !state.statsSidebarOpen })),

      toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },

      setPaperColor: (color) => {
        set({ paperColor: color })
        applyPaperColor(color)
      },

      toggleWordCount: () => set((state) => ({ showWordCount: !state.showWordCount })),

      toggleFocusMode: () => set((state) => ({
        focusMode: !state.focusMode,
        sidebarOpen: state.focusMode, // Open sidebar when exiting focus mode
        statsSidebarOpen: state.focusMode, // Open stats sidebar when exiting focus mode
        rightPanelOpen: false
      })),

      openSettings: () => set({ settingsOpen: true }),
      closeSettings: () => set({ settingsOpen: false }),
      setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
      setAutoSaveInterval: (seconds) => set({ autoSaveInterval: seconds }),
      setZoomLevel: (level) => set({ zoomLevel: Math.min(200, Math.max(50, level)) }),
      zoomIn: () => set((state) => ({ zoomLevel: Math.min(200, state.zoomLevel + 10) })),
      zoomOut: () => set((state) => ({ zoomLevel: Math.max(50, state.zoomLevel - 10) })),
      resetZoom: () => set({ zoomLevel: 100 })
    }),
    {
      name: 'palimpseste-ui-settings',
      partialize: (state) => ({
        theme: state.theme,
        paperColor: state.paperColor,
        autoSaveEnabled: state.autoSaveEnabled,
        autoSaveInterval: state.autoSaveInterval,
        zoomLevel: state.zoomLevel
      }),
      onRehydrateStorage: () => (state) => {
        // Apply saved settings on app start
        if (state) {
          applyTheme(state.theme)
          applyPaperColor(state.paperColor)
        }
      }
    }
  )
)
