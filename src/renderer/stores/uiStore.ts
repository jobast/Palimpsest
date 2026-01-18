import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SidebarPanel = 'project' | 'sheets' | 'analysis' | 'pages'

interface UIState {
  sidebarOpen: boolean
  sidebarPanel: SidebarPanel
  statsSidebarOpen: boolean
  rightPanelOpen: boolean
  theme: 'light' | 'dark' | 'system'
  showWordCount: boolean
  focusMode: boolean
  settingsOpen: boolean

  // Auto-save settings
  autoSaveEnabled: boolean
  autoSaveInterval: number // in seconds

  // Actions
  toggleSidebar: () => void
  setSidebarPanel: (panel: SidebarPanel) => void
  toggleStatsSidebar: () => void
  toggleRightPanel: () => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  toggleWordCount: () => void
  toggleFocusMode: () => void
  openSettings: () => void
  closeSettings: () => void
  setAutoSaveEnabled: (enabled: boolean) => void
  setAutoSaveInterval: (seconds: number) => void
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

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarPanel: 'project',
      statsSidebarOpen: true,
      rightPanelOpen: false,
      theme: 'light',
      showWordCount: true,
      focusMode: false,
      settingsOpen: false,

      // Auto-save settings (default: enabled, 30 seconds)
      autoSaveEnabled: true,
      autoSaveInterval: 30,

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarPanel: (panel) => set({ sidebarPanel: panel, sidebarOpen: true }),

      toggleStatsSidebar: () => set((state) => ({ statsSidebarOpen: !state.statsSidebarOpen })),

      toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
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
      setAutoSaveInterval: (seconds) => set({ autoSaveInterval: seconds })
    }),
    {
      name: 'palimpseste-ui-settings',
      partialize: (state) => ({
        theme: state.theme,
        autoSaveEnabled: state.autoSaveEnabled,
        autoSaveInterval: state.autoSaveInterval
      }),
      onRehydrate: () => (state) => {
        // Apply theme when store rehydrates
        if (state) {
          applyTheme(state.theme)
        }
      }
    }
  )
)
